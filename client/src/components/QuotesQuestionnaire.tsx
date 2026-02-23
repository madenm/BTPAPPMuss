import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getQuestionsForType } from '@/lib/estimationQuestionnaire';
import type { QuestionnaireQuestion } from '@/lib/estimationQuestionnaire';
import { ChevronDown } from 'lucide-react';

export interface QuotesQuestionnaireProps {
  projectType: string;
  answers: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
}

function hasAnswered(q: QuestionnaireQuestion, answers: Record<string, string>): boolean {
  const v = (answers[q.id] ?? '').trim();
  return q.type === 'text' ? v.length >= 1 : !!v;
}

export function QuotesQuestionnaire({ projectType, answers, onChange }: QuotesQuestionnaireProps) {
  const questions = projectType ? getQuestionsForType(projectType) : [];

  if (questions.length === 0) return null;

  const firstUnanswered = questions.findIndex((q) => !hasAnswered(q, answers));
  const endIndex = firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  const visibleQuestions = questions.slice(0, endIndex + 1);

  return (
    <Collapsible defaultOpen={true}>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <span className="font-bold">Questions complémentaires (optionnel)</span>
            <ChevronDown className="h-4 w-4 shrink-0 collapsible-icon" />
          </button>
        </CollapsibleTrigger>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Plus vous répondez aux questions, plus le devis sera précis. Toutes les questions sont optionnelles.
        </p>
        <CollapsibleContent>
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
            {visibleQuestions.map((q, index) => (
              <div key={q.id} className="space-y-1.5">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Question {index + 1} / {questions.length}
                </p>
                <label className="text-sm text-gray-700 dark:text-gray-300 block">{q.label}</label>
                {q.type === 'text' ? (
                  <Input
                    type="text"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => onChange(q.id, e.target.value)}
                    placeholder={q.id === 'autre_description' ? 'Décrivez...' : 'Saisissez...'}
                    className="text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 h-8"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(q.options ?? []).map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={answers[q.id] === opt.value ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 text-xs px-2 ${
                          answers[q.id] === opt.value
                            ? 'bg-violet-500 hover:bg-violet-600 text-white border-violet-500'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        onClick={() => onChange(q.id, opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
