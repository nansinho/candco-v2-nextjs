"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitQuestionnaireResponse } from "@/actions/questionnaires";

interface Question {
  id: string;
  texte: string;
  type: string;
  options: { label: string; value: string }[] | null;
  obligatoire: boolean;
  ordre: number;
}

export function PublicQuestionnaireForm({
  token,
  questionnaire,
  questions,
  respondentName,
}: {
  token: string;
  questionnaire: { id: string; nom: string; type: string; introduction: string | null };
  questions: Question[];
  respondentName: string;
}) {
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Build responses array
    const responses = questions.map((q) => ({
      question_id: q.id,
      answer: (answers[q.id] ?? "") as string | string[] | number | boolean,
      score: 0,
    }));

    const result = await submitQuestionnaireResponse(token, responses);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  if (isSubmitted) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
        <h1 className="mt-4 text-xl font-semibold">Merci pour votre reponse !</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos reponses ont bien ete enregistrees.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <h1 className="text-2xl font-semibold">{questionnaire.nom}</h1>
        {respondentName && (
          <p className="mt-1 text-sm text-muted-foreground">
            Bonjour {respondentName}
          </p>
        )}
        {questionnaire.introduction && (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {questionnaire.introduction}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Questions */}
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-lg border border-border/60 bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="text-xs font-mono text-muted-foreground/60 pt-0.5">{i + 1}.</span>
            <div className="flex-1 space-y-3">
              <p className="text-[14px] font-medium">
                {q.texte}
                {q.obligatoire && <span className="text-destructive ml-1">*</span>}
              </p>

              {/* Texte libre */}
              {q.type === "libre" && (
                <textarea
                  rows={3}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground resize-none"
                  placeholder="Votre reponse..."
                  required={q.obligatoire}
                />
              )}

              {/* Echelle 0-10 */}
              {q.type === "echelle" && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      className={`h-9 w-9 rounded-md border text-sm font-mono transition-colors ${
                        answers[q.id] === n
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 bg-muted hover:bg-muted/80 text-foreground"
                      }`}
                      onClick={() => setAnswer(q.id, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {/* Choix unique */}
              {q.type === "choix_unique" && (q.options ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value={opt.value}
                        checked={answers[q.id] === opt.value}
                        onChange={() => setAnswer(q.id, opt.value)}
                        className="h-4 w-4 accent-primary"
                        required={q.obligatoire}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Choix multiple */}
              {q.type === "choix_multiple" && (q.options ?? []).length > 0 && (
                <div className="space-y-1.5">
                  {(q.options ?? []).map((opt) => {
                    const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                    return (
                      <label key={opt.value} className="flex items-center gap-2.5 rounded-md px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected.includes(opt.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAnswer(q.id, [...selected, opt.value]);
                            } else {
                              setAnswer(q.id, selected.filter((v) => v !== opt.value));
                            }
                          }}
                          className="h-4 w-4 rounded accent-primary"
                        />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Vrai / Faux */}
              {q.type === "vrai_faux" && (
                <div className="flex items-center gap-3">
                  {[{ label: "Vrai", value: "true" }, { label: "Faux", value: "false" }].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 rounded-md px-4 py-2 border border-border/60 hover:bg-muted/30 cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        value={opt.value}
                        checked={String(answers[q.id]) === opt.value}
                        onChange={() => setAnswer(q.id, opt.value)}
                        className="h-4 w-4 accent-primary"
                        required={q.obligatoire}
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="h-10 px-6">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            "Envoyer mes reponses"
          )}
        </Button>
      </div>
    </form>
  );
}
