import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAccountButton } from "@/components/UserAccountButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  fetchTariffs,
  insertTariff,
  insertTariffsBatch,
  updateTariff,
  deleteTariff,
  type UserTariff,
  type NewUserTariffPayload,
  type TariffCategory,
} from "@/lib/supabaseTariffs";
import { Plus, Pencil, Trash2, Upload, Download, Loader2, Search, MoreVertical, Copy, Tag } from "lucide-react";
import * as XLSX from "xlsx";

const CATEGORIES: TariffCategory[] = ["matériau", "service", "main-d'œuvre", "location", "sous-traitance", "transport", "équipement", "fourniture", "autre"];
const UNITS = ["u", "m²", "m", "m³", "jour", "forfait", "L", "kg", "ml"];

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/^libelle$/, "label")
    .replace(/^categorie$/, "category")
    .replace(/^unite$/, "unit")
    .replace(/^prix_ht$|^prix\s*ht$/i, "price_ht");
}

export interface ParsedTariffRow {
  label: string;
  category: TariffCategory;
  unit: string;
  price_ht: number;
}

function parseCsv(text: string): ParsedTariffRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const headerLine = lines[0];
  const headers = headerLine.split(delim).map((c) => normalizeHeader(c.trim()));
  const labelIdx = headers.findIndex((h) => h === "label" || h === "libelle");
  const categoryIdx = headers.findIndex((h) => h === "category" || h === "categorie");
  const unitIdx = headers.findIndex((h) => h === "unit" || h === "unite");
  const priceIdx = headers.findIndex((h) => h === "price_ht" || h.startsWith("prix"));
  if (labelIdx === -1 || priceIdx === -1) return [];
  const rows: ParsedTariffRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const label = (cells[labelIdx] ?? "").trim();
    const priceVal = parseFloat((cells[priceIdx] ?? "0").replace(",", "."));
    if (!label || isNaN(priceVal) || priceVal < 0) continue;
    const category = (categoryIdx >= 0 && cells[categoryIdx])
      ? ((CATEGORIES as string[]).includes(cells[categoryIdx].toLowerCase())
        ? (cells[categoryIdx].toLowerCase() as TariffCategory)
        : "autre")
      : "autre";
    const unit = (unitIdx >= 0 && cells[unitIdx]) ? cells[unitIdx].trim() || "u" : "u";
    rows.push({ label, category, unit, price_ht: priceVal });
  }
  return rows;
}

function parseExcel(file: File): Promise<ParsedTariffRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || typeof data !== "object" || !(data instanceof ArrayBuffer)) {
          resolve([]);
          return;
        }
        const wb = XLSX.read(data, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          resolve([]);
          return;
        }
        const json = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 });
        if (!Array.isArray(json) || json.length < 2) {
          resolve([]);
          return;
        }
        const headerRow = (json[0] as string[]).map((c) => normalizeHeader(String(c ?? "").trim()));
        const labelIdx = headerRow.findIndex((h) => h === "label" || h === "libelle");
        const categoryIdx = headerRow.findIndex((h) => h === "category" || h === "categorie");
        const unitIdx = headerRow.findIndex((h) => h === "unit" || h === "unite");
        const priceIdx = headerRow.findIndex((h) => h === "price_ht" || String(h).startsWith("prix"));
        if (labelIdx === -1 || priceIdx === -1) {
          resolve([]);
          return;
        }
        const rows: ParsedTariffRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] as string[];
          if (!Array.isArray(row)) continue;
          const label = String(row[labelIdx] ?? "").trim();
          const priceVal = parseFloat(String(row[priceIdx] ?? "0").replace(",", "."));
          if (!label || isNaN(priceVal) || priceVal < 0) continue;
          const category =
            categoryIdx >= 0 && row[categoryIdx]
              ? ((CATEGORIES as string[]).includes(String(row[categoryIdx]).toLowerCase())
                ? (String(row[categoryIdx]).toLowerCase() as TariffCategory)
                : "autre")
              : "autre";
          const unit = unitIdx >= 0 && row[unitIdx] ? String(row[unitIdx]).trim() || "u" : "u";
          rows.push({ label, category, unit, price_ht: priceVal });
        }
        resolve(rows);
      } catch {
        resolve([]);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function getTemplateCsvBlob(): Blob {
  const header = "label;category;unit;price_ht\n";
  const sample = "Peinture murale;matériau;m²;25.50\nMain d'œuvre jour;service;jour;350\n";
  return new Blob(["\uFEFF" + header + sample], { type: "text/csv;charset=utf-8" });
}

interface TariffFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tariff: UserTariff | null;
  onSave: (payload: NewUserTariffPayload) => Promise<void>;
  isSaving: boolean;
}

function TariffFormModal({ open, onOpenChange, tariff, onSave, isSaving }: TariffFormModalProps) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<TariffCategory>("autre");
  const [unit, setUnit] = useState("u");
  const [priceHt, setPriceHt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (tariff) {
        setLabel(tariff.label);
        setCategory(tariff.category);
        setUnit(tariff.unit || "u");
        setPriceHt(String(tariff.price_ht));
      } else {
        setLabel("");
        setCategory("autre");
        setUnit("u");
        setPriceHt("");
      }
      setErrors({});
    }
  }, [open, tariff]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!label.trim()) err.label = "Libellé requis";
    const p = parseFloat(priceHt.replace(",", "."));
    if (priceHt.trim() === "" || isNaN(p) || p < 0) err.price_ht = "Prix HT invalide";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const p = parseFloat(priceHt.replace(",", "."));
    await onSave({
      label: label.trim(),
      category,
      unit: unit.trim() || "u",
      price_ht: p,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-white">
            {tariff ? "Modifier le tarif" : "Ajouter un tarif"}
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {tariff ? "Modifiez les champs ci-dessous." : "Renseignez le libellé, la catégorie, l'unité et le prix HT."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label className="text-white">Libellé *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Peinture murale"
              className={`mt-1 bg-black/20 border-white/10 text-white placeholder:text-white/50 ${errors.label ? "border-red-400" : ""}`}
            />
            {errors.label && <p className="text-xs text-red-300 mt-0.5">{errors.label}</p>}
          </div>
          <div>
            <Label className="text-white">Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as TariffCategory)}>
              <SelectTrigger className="mt-1 bg-black/20 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-white">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white">Unité</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="mt-1 bg-black/20 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="text-white">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white">Prix HT (€) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={priceHt}
              onChange={(e) => setPriceHt(e.target.value)}
              placeholder="0.00"
              className={`mt-1 bg-black/20 border-white/10 text-white placeholder:text-white/50 ${errors.price_ht ? "border-red-400" : ""}`}
            />
            {errors.price_ht && <p className="text-xs text-red-300 mt-0.5">{errors.price_ht}</p>}
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button
            type="button"
            variant="outline"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="bg-white/20 text-white border border-white/10 hover:bg-white/30"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CATEGORY_BADGE: Record<TariffCategory, { label: string; className: string }> = {
  "matériau": { label: "Matériau", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  "service": { label: "Service", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "main-d'œuvre": { label: "Main-d'œuvre", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  "location": { label: "Location", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  "sous-traitance": { label: "Sous-traitance", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  "transport": { label: "Transport", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  "équipement": { label: "Équipement", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  "fourniture": { label: "Fourniture", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  "autre": { label: "Autre", className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
};

export default function TarifsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tariffs, setTariffs] = useState<UserTariff[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<UserTariff | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserTariff | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filteredTariffs = useMemo(() => {
    let result = tariffs;
    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((t) => t.label.toLowerCase().includes(q));
    }
    return result;
  }, [tariffs, categoryFilter, searchQuery]);

  const loadTariffs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await fetchTariffs(user.id);
      setTariffs(data);
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Impossible de charger les tarifs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    loadTariffs();
  }, [loadTariffs]);

  const handleSave = useCallback(
    async (payload: NewUserTariffPayload) => {
      if (!user?.id) return;
      setIsSaving(true);
      try {
        if (editingTariff) {
          await updateTariff(editingTariff.id, user.id, payload);
          toast({ title: "Tarif modifié" });
        } else {
          await insertTariff(user.id, payload);
          toast({ title: "Tarif ajouté" });
        }
        setModalOpen(false);
        setEditingTariff(null);
        await loadTariffs();
      } catch (e) {
        toast({
          title: "Erreur",
          description: e instanceof Error ? e.message : "Enregistrement impossible",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, editingTariff, loadTariffs, toast]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !user?.id) return;
    setIsDeleting(true);
    try {
      await deleteTariff(deleteTarget.id, user.id);
      toast({ title: "Tarif supprimé" });
      setDeleteTarget(null);
      await loadTariffs();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Suppression impossible",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, user?.id, loadTariffs, toast]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = getTemplateCsvBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tarifs_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Modèle téléchargé (tarifs_template.csv)" });
  }, [toast]);

  const handleDuplicate = useCallback(
    async (tariff: UserTariff) => {
      if (!user?.id) return;
      try {
        const duplicated = await insertTariff(user.id, {
          label: `${tariff.label} (copie)`,
          category: tariff.category,
          unit: tariff.unit,
          price_ht: tariff.price_ht,
        });
        setTariffs((prev) => [...prev, duplicated].sort((a, b) => a.label.localeCompare(b.label)));
        toast({ title: "Tarif dupliqué" });
      } catch (e) {
        toast({
          title: "Erreur",
          description: e instanceof Error ? e.message : "Duplication impossible",
          variant: "destructive",
        });
      }
    },
    [user?.id, toast]
  );

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImportFile(file || null);
    e.target.value = "";
  };

  const handleImportSubmit = useCallback(async () => {
    if (!importFile || !user?.id) return;
    setImporting(true);
    try {
      const ext = (importFile.name.split(".").pop() || "").toLowerCase();
      let rows: ParsedTariffRow[];
      if (ext === "csv") {
        const text = await importFile.text();
        rows = parseCsv(text);
      } else if (ext === "xlsx" || ext === "xls") {
        rows = await parseExcel(importFile);
      } else {
        toast({
          title: "Format non supporté",
          description: "Utilisez un fichier .csv ou .xlsx",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }
      if (rows.length === 0) {
        toast({
          title: "Aucune ligne valide",
          description: "Vérifiez les colonnes : label (ou Libellé), price_ht (ou Prix HT). Catégorie et Unité optionnels.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }
      const { inserted, errors: errCount } = await insertTariffsBatch(user.id, rows);
      setImportOpen(false);
      setImportFile(null);
      toast({
        title: "Import terminé",
        description: `${inserted} ligne(s) importée(s)${errCount > 0 ? `, ${errCount} erreur(s)` : ""}.`,
      });
      await loadTariffs();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Import impossible",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }, [importFile, user?.id, loadTariffs, toast]);

  return (
    <PageWrapper>
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4 rounded-tl-3xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:min-w-0">
          <div className="min-w-0 w-full sm:flex-1 pl-20">
            <h1 className="text-lg sm:text-2xl font-bold text-white sm:truncate">Tarifs</h1>
            <p className="text-xs sm:text-sm text-white/70 sm:truncate">
              Gérez vos prix (matériaux, services) pour les devis et l'analyse IA
            </p>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <UserAccountButton variant="inline" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 overflow-x-hidden">
        <main className="space-y-6 py-4 sm:py-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                setEditingTariff(null);
                setModalOpen(true);
              }}
              className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un tarif
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20"
            >
              <Download className="h-4 w-4 mr-2" />
              Modèle CSV
            </Button>
          </div>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 shadow-xl rounded-2xl">
            <CardHeader className="space-y-0">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <CardTitle className="text-gray-900 dark:text-white font-light flex items-center gap-2">
                  <Tag className="h-5 w-5 text-violet-500" />
                  Tous les tarifs
                  {!loading && (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      ({filteredTariffs.length}{filteredTariffs.length !== tariffs.length ? ` / ${tariffs.length}` : ""})
                    </span>
                  )}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher un tarif..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 rounded-xl border-gray-200 dark:border-gray-700"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px] rounded-xl border-gray-200 dark:border-gray-700">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_BADGE[c].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  Chargement des tarifs...
                </div>
              ) : tariffs.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun tarif</p>
                  <p className="text-sm mt-1">Ajoutez vos tarifs ou importez un fichier CSV/Excel.</p>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    <Button
                      className="rounded-xl bg-violet-500 hover:bg-violet-600 text-white"
                      onClick={() => setModalOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter un tarif
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setImportOpen(true)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Importer
                    </Button>
                  </div>
                </div>
              ) : filteredTariffs.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Aucun résultat</p>
                  <p className="text-sm mt-1">Essayez un autre terme de recherche ou changez le filtre.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="rounded-tl-xl">Libellé</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead className="text-right">Prix HT (€)</TableHead>
                        <TableHead className="text-right rounded-tr-xl w-[60px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTariffs.map((t) => (
                        <TableRow key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <TableCell className="font-medium text-gray-900 dark:text-white">
                            {t.label}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={CATEGORY_BADGE[t.category]?.className ?? CATEGORY_BADGE.autre.className}>
                              {CATEGORY_BADGE[t.category]?.label ?? t.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600 dark:text-gray-400">{t.unit}</TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(t.price_ht))}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => { setEditingTariff(t); setModalOpen(true); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(t)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Dupliquer
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(t)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <TariffFormModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingTariff(null);
        }}
        tariff={editingTariff}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce tarif ?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[420px] bg-black/20 backdrop-blur-xl border border-white/10 text-white rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-white">Importer des tarifs</DialogTitle>
            <DialogDescription className="text-white/70">
              Choisissez un fichier CSV ou Excel. Colonnes attendues : Libellé (ou label), Prix HT (ou price_ht).
              Catégorie et Unité optionnels. Délimiteur CSV : ; ou ,
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportFileChange}
              className="block w-full text-sm text-white/80 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-white/20 file:text-white"
            />
            {importFile && (
              <p className="mt-2 text-sm text-white/60">{importFile.name}</p>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={() => setImportOpen(false)}
            >
              Annuler
            </Button>
            <Button
              className="bg-white/20 text-white border border-white/10 hover:bg-white/30"
              onClick={handleImportSubmit}
              disabled={!importFile || importing}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
