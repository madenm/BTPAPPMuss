import { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { useChantiers, type Chantier } from '@/context/ChantiersContext';
import { fetchTeamMembers, fetchChantierAssignmentsByChantier, addChantierAssignment, removeChantierAssignment, type TeamMember } from '@/lib/supabase';
import { uploadFile, removeFile, publicUrlToPath } from '@/lib/supabaseStorage';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { Building, Plus, Calendar as CalendarIcon, Image as ImageIcon, X } from 'lucide-react';

function formatDateToDDMMYYYY(iso?: string): string {
  if (!iso) return '';
  const part = iso.slice(0, 10);
  const [y, m, d] = part.split('-').map(Number);
  if (y == null || m == null || d == null || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

function parseDDMMYYYYToISO(str: string): string {
  const trimmed = str.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[/.-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  let day = parseInt(d, 10);
  let month = parseInt(m, 10);
  let year = parseInt(y, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
  if (year < 100) year += 2000;
  if (month < 1 || month > 12) return '';
  const lastDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > lastDay) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateInputValue(dateDebut: string): string {
  if (!dateDebut) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return formatDateToDDMMYYYY(dateDebut);
  return dateDebut;
}

function dateInputToISO(dateDebut: string): string {
  if (!dateDebut) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateDebut)) return dateDebut;
  return parseDDMMYYYYToISO(dateDebut);
}

function isoToDate(iso: string): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return undefined;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface ChantierEditDialogProps {
  chantier: Chantier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function ChantierEditDialog({ chantier, open, onOpenChange, onSaved }: ChantierEditDialogProps) {
  const { user } = useAuth();
  const { clients, addClient, updateChantier } = useChantiers();
  const fileInputId = useRef(`edit-chantier-images-${Math.random().toString(36).slice(2)}`).current;

  const [editChantier, setEditChantier] = useState<Partial<Chantier> & { images: string[] }>({
    nom: '',
    clientId: '',
    clientName: '',
    dateDebut: '',
    duree: '',
    images: [],
    statut: 'planifié',
    notes: '',
    notesAvancement: '',
    typeChantier: undefined,
  });
  const [editDatePickerOpen, setEditDatePickerOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [editAssignedMemberIds, setEditAssignedMemberIds] = useState<string[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [uploadingEditImages, setUploadingEditImages] = useState(false);

  useEffect(() => {
    if (!open || !chantier) return;
    setEditChantier({
      id: chantier.id,
      nom: chantier.nom,
      clientId: chantier.clientId,
      clientName: chantier.clientName,
      dateDebut: chantier.dateDebut,
      duree: chantier.duree,
      images: [...chantier.images],
      statut: chantier.statut,
      notes: chantier.notes || '',
      notesAvancement: chantier.notesAvancement || '',
    });
    setLoadingAssignments(true);
    Promise.all([
      fetchTeamMembers(),
      fetchChantierAssignmentsByChantier(chantier.id),
    ])
      .then(([members, assigned]) => {
        setTeamMembers(members);
        setEditAssignedMemberIds(assigned.map((m) => m.id));
      })
      .catch(() => {
        setTeamMembers([]);
        setEditAssignedMemberIds([]);
      })
      .finally(() => setLoadingAssignments(false));
  }, [open, chantier?.id]);

  const handleAddClient = () => {
    void addClient({
      name: `Client ${clients.length + 1}`,
      email: '',
      phone: '',
    });
  };

  const toggleMemberAssignment = (memberId: string, checked: boolean) => {
    setEditAssignedMemberIds((prev) =>
      checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)
    );
  };

  const handleAddImagesToChantier = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!user?.id || !chantier || !e.target.files || e.target.files.length === 0) {
        e.target.value = '';
        return;
      }
      const files = Array.from(e.target.files);
      setUploadingEditImages(true);
      const pathPrefix = `${user.id}/chantiers/${chantier.id}`;
      const processFiles = async () => {
        const newUrls: string[] = [];
        for (const file of files) {
          try {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `${pathPrefix}/${Date.now()}-${safeName}`;
            const url = await uploadFile(path, file);
            newUrls.push(url);
          } catch (err) {
            console.error('Upload failed:', err);
            alert("Erreur lors de l'upload d'une image. Réessayez.");
          }
        }
        setUploadingEditImages(false);
        if (newUrls.length > 0) {
          setEditChantier((prev) => ({
            ...prev,
            images: [...(prev.images || []), ...newUrls],
          }));
        }
      };
      processFiles();
      e.target.value = '';
    },
    [user?.id, chantier]
  );

  const handleRemoveImageFromChantier = async (index: number) => {
    const currentImages = editChantier.images || [];
    const urlOrData = currentImages[index];
    if (urlOrData?.startsWith('http') && urlOrData.includes('/storage/')) {
      try {
        await removeFile(publicUrlToPath(urlOrData));
      } catch (err) {
        console.error('Delete from storage failed:', err);
      }
    }
    setEditChantier((prev) => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleUpdateChantier = async () => {
    const dateDebutIso = dateInputToISO(editChantier.dateDebut || '');
    if (!chantier || !editChantier.nom || !editChantier.clientId || !dateDebutIso || !editChantier.duree) {
      return;
    }
    try {
      const client = clients.find((c) => c.id === editChantier.clientId);
      await updateChantier(chantier.id, {
        nom: editChantier.nom,
        clientId: editChantier.clientId,
        clientName: client?.name || editChantier.clientName || 'Client inconnu',
        dateDebut: dateDebutIso,
        duree: editChantier.duree,
        images: editChantier.images || [],
        statut: editChantier.statut || 'planifié',
        notes: editChantier.notes || undefined,
        notesAvancement: editChantier.notesAvancement || undefined,
        typeChantier: editChantier.typeChantier || undefined,
      });
      const currentAssigned = await fetchChantierAssignmentsByChantier(chantier.id);
      const currentIds = currentAssigned.map((m) => m.id);
      for (const memberId of editAssignedMemberIds) {
        if (!currentIds.includes(memberId)) await addChantierAssignment(chantier.id, memberId);
      }
      for (const memberId of currentIds) {
        if (!editAssignedMemberIds.includes(memberId)) await removeChantierAssignment(chantier.id, memberId);
      }
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du projet:', error);
      alert("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
    }
  };

  if (!chantier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/20 backdrop-blur-xl border border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Modifier le projet</DialogTitle>
          <DialogDescription className="text-white/70">
            Modifiez les informations du projet et ajoutez des notes sur l'avancement
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-white">Nom du projet</Label>
            <Input
              value={editChantier.nom}
              onChange={(e) => setEditChantier({ ...editChantier, nom: e.target.value })}
              placeholder="Ex: Rénovation salle de bain"
              className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div>
            <Label className="text-white">Client</Label>
            <div className="flex gap-2">
              <Select
                value={editChantier.clientId}
                onValueChange={(value) => {
                  const client = clients.find((c) => c.id === value);
                  setEditChantier({ ...editChantier, clientId: value, clientName: client?.name || '' });
                }}
              >
                <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="text-white">
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleAddClient} className="text-white border-white/20 hover:bg-white/10">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Date de début</Label>
              <Popover open={editDatePickerOpen} onOpenChange={setEditDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9 bg-black/20 backdrop-blur-md border-white/10 text-white hover:bg-black/30 hover:border-white/20"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                    {dateInputValue(editChantier.dateDebut || '') || 'JJ/MM/AAAA'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-black/90 border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={isoToDate(dateInputToISO(editChantier.dateDebut || '')) ?? undefined}
                    onSelect={(d) => {
                      if (d) {
                        setEditChantier({ ...editChantier, dateDebut: dateToISO(d) });
                        setEditDatePickerOpen(false);
                      }
                    }}
                    classNames={{
                      day_button: "text-white hover:bg-white/20",
                      caption_label: "text-white",
                      nav_button: "text-white",
                      head_cell: "text-white/70",
                      day_outside: "text-white/40",
                      day_today: "bg-white/20 text-white",
                      day_selected: "bg-violet-500 text-white",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-white">Durée</Label>
              <Input
                value={editChantier.duree}
                onChange={(e) => setEditChantier({ ...editChantier, duree: e.target.value })}
                placeholder="Ex: 2 semaines"
                className="bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
              />
            </div>
          </div>

          <div>
            <Label className="text-white">Type de projet</Label>
            <Select
              value={editChantier.typeChantier ?? ''}
              onValueChange={(value) => setEditChantier({ ...editChantier, typeChantier: value || undefined })}
            >
              <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                <SelectValue placeholder="Sélectionner le type" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                <SelectItem value="piscine" className="text-white">Piscine & Spa</SelectItem>
                <SelectItem value="paysage" className="text-white">Aménagement Paysager</SelectItem>
                <SelectItem value="menuiserie" className="text-white">Menuiserie Sur-Mesure</SelectItem>
                <SelectItem value="renovation" className="text-white">Rénovation</SelectItem>
                <SelectItem value="plomberie" className="text-white">Plomberie</SelectItem>
                <SelectItem value="maconnerie" className="text-white">Maçonnerie</SelectItem>
                <SelectItem value="terrasse" className="text-white">Terrasse & Patio</SelectItem>
                <SelectItem value="chauffage" className="text-white">Chauffage & Climatisation</SelectItem>
                <SelectItem value="isolation" className="text-white">Isolation de la charpente</SelectItem>
                <SelectItem value="electricite" className="text-white">Électricité</SelectItem>
                <SelectItem value="peinture" className="text-white">Peinture & Revêtements</SelectItem>
                <SelectItem value="autre" className="text-white">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Statut</Label>
            <Select
              value={editChantier.statut}
              onValueChange={(value: 'planifié' | 'en cours' | 'terminé') =>
                setEditChantier({ ...editChantier, statut: value })
              }
            >
              <SelectTrigger className="bg-black/20 backdrop-blur-md border-white/10 text-white">
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent className="bg-black/20 backdrop-blur-xl border-white/10">
                <SelectItem value="planifié" className="text-white">Planifié</SelectItem>
                <SelectItem value="en cours" className="text-white">En cours</SelectItem>
                <SelectItem value="terminé" className="text-white">Terminé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white">Description du projet</Label>
            <div className="flex gap-2">
              <Textarea
                value={editChantier.notes || ''}
                onChange={(e) => setEditChantier({ ...editChantier, notes: e.target.value })}
                placeholder="Description du projet (reprise dans le devis)."
                rows={3}
                className="flex-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
              />
              <VoiceInputButton
                onTranscript={(text) => {
                  setEditChantier((prev) => ({
                    ...prev,
                    notes: prev.notes?.trim() ? `${prev.notes} ${text}` : text,
                  }));
                }}
                className="self-start mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="text-white">Notes sur l'avancement du projet</Label>
            <div className="flex gap-2">
              <Textarea
                value={editChantier.notesAvancement || ''}
                onChange={(e) => setEditChantier({ ...editChantier, notesAvancement: e.target.value })}
                placeholder="Notes sur l'avancement, points bloquants, remarques..."
                rows={4}
                className="flex-1 bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
              />
              <VoiceInputButton
                onTranscript={(text) => {
                  setEditChantier((prev) => ({
                    ...prev,
                    notesAvancement: prev.notesAvancement?.trim() ? `${prev.notesAvancement} ${text}` : text,
                  }));
                }}
                className="self-start mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-white">Images actuelles</Label>
            {editChantier.images && editChantier.images.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {editChantier.images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`Image ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImageFromChantier(index)}
                      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-white/50 mt-2">Aucune image</p>
            )}
          </div>

          <div>
            <Label className="text-white">Ajouter des images</Label>
            <input
              id={fileInputId}
              name="chantierEditImages"
              type="file"
              multiple
              accept="image/*"
              onChange={handleAddImagesToChantier}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById(fileInputId)?.click()}
              disabled={!user?.id || uploadingEditImages}
              className="w-full text-white border-white/20 hover:bg-white/10"
            >
              <ImageIcon className="h-4 w-4 mr-2" />
              {uploadingEditImages ? 'Upload en cours...' : 'Ajouter des images'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-white">Membres affectés</Label>
            <p className="text-xs text-white/60">Membres de l'équipe ayant accès à ce projet.</p>
            {loadingAssignments ? (
              <p className="text-sm text-white/50">Chargement...</p>
            ) : teamMembers.length === 0 ? (
              <p className="text-sm text-white/50">Aucun membre. Ajoutez des membres depuis Gestion de l'équipe.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2 mt-2 p-2 rounded-lg bg-black/20 border border-white/10">
                {teamMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 cursor-pointer text-sm text-white/90 hover:text-white"
                  >
                    <Checkbox
                      checked={editAssignedMemberIds.includes(member.id)}
                      onCheckedChange={(checked) => toggleMemberAssignment(member.id, !!checked)}
                      className="border-white/30 data-[state=checked]:bg-white/20"
                    />
                    <span>{member.name}</span>
                    <span className="text-white/50 text-xs">({member.role})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-white border-white/20 hover:bg-white/10">
              Annuler
            </Button>
            <Button
              onClick={handleUpdateChantier}
              disabled={
                !editChantier.nom ||
                !editChantier.clientId ||
                !dateInputToISO(editChantier.dateDebut || '') ||
                !editChantier.duree
              }
              className="bg-white/20 backdrop-blur-md text-white border border-white/10 hover:bg-white/30 disabled:opacity-50"
            >
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
