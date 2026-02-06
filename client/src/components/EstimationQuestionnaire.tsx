import { Button } from '@/components/ui/button';
import { getQuestionsForType } from '@/lib/estimationQuestionnaire';
import type { QuestionnaireQuestion } from '@/lib/estimationQuestionnaire';

export interface EstimationQuestionnaireProps {
  type: string;
  answers: Record<string, string>;
  onChange: (questionId: string, value: string) => void;
}

function hasValidAnswer(q: QuestionnaireQuestion, answers: Record<string, string>): boolean {
  const v = (answers[q.id] ?? '').trim();
  return q.type === 'text' ? v.length >= (q.id === 'autre_description' ? 20 : 1) : !!v;
}

export function EstimationQuestionnaire({ type, answers, onChange }: EstimationQuestionnaireProps) {
  const questions = type ? getQuestionsForType(type) : [];

  if (questions.length === 0) return null;

  const firstUnanswered = questions.findIndex((q) => !hasValidAnswer(q, answers));
  const endIndex = firstUnanswered === -1 ? questions.length - 1 : firstUnanswered;
  const visibleQuestions = questions.slice(0, endIndex + 1);

  return (
    <div className="md:col-span-2 space-y-4">
      {visibleQuestions.map((q, index) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm text-white/60">
            Question {index + 1} / {questions.length}
          </p>
          <label className="text-sm font-medium text-white block">
            {q.label}
            {q.required ? ' *' : ''}
          </label>
          {q.type === 'text' ? (
            <input
              type="text"
              value={answers[q.id] ?? ''}
              onChange={(e) => onChange(q.id, e.target.value)}
              className="w-full px-3 py-2 rounded-md border bg-black/20 backdrop-blur-md border-white/10 text-white placeholder:text-white/50"
              placeholder={q.id === 'autre_description' ? 'Décrivez votre projet en 20 caractères minimum...' : 'Saisissez...'}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={answers[q.id] === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className={
                    answers[q.id] === opt.value
                      ? 'bg-white/30 text-white border-white/30'
                      : 'text-white border-white/20 hover:bg-white/10'
                  }
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
  );
}
