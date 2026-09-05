import { DEFAULT_PIPELINE, DEFAULT_PIPELINE_QUESTIONS } from "@/lib/pipeline";
import { useSiteWalk } from "@/lib/store";
import { Badge, Button, Card, Field, Textarea } from "./ui";

export function PipelineView() {
  const rows = useSiteWalk((s) => (s.pipeline?.length ? s.pipeline : DEFAULT_PIPELINE));
  const questions = useSiteWalk((s) =>
    s.pipelineQuestions?.length ? s.pipelineQuestions : DEFAULT_PIPELINE_QUESTIONS,
  );
  const update = useSiteWalk((s) => s.updatePipeline);
  const confirm = useSiteWalk((s) => s.setPipelineConfirmed);
  const answer = useSiteWalk((s) => s.updatePipelineAnswer);
  const reset = useSiteWalk((s) => s.resetPipeline);
  const confirmedCount = rows.filter((r) => !r.draft).length;

  return (
    <div>
      <h2 className="mb-1 text-lg font-medium tracking-tight text-ink">Land-to-closing map</h2>
      <p className="mb-3 text-sm text-muted">
        Sit with him and correct the draft. Tap <strong>Confirm</strong> on a stage when it’s right.
        Answers at the top save as you type.
      </p>
      <p className="mb-3 font-mono text-xs tabular-nums text-muted">
        {confirmedCount}/{rows.length} stages confirmed
      </p>
      <Card className="mb-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Ask him directly</p>
        {questions.map((q) => (
          <label key={q.id} className="block">
            <span className="text-sm text-ink">{q.question}</span>
            <div className="mt-1">
              <Textarea
                value={q.answer}
                placeholder="His answer"
                onChange={(e) => answer(q.id, e.target.value)}
              />
            </div>
          </label>
        ))}
      </Card>
      <Button variant="secondary" className="mb-4 w-full" onClick={() => reset()}>
        Reset to draft
      </Button>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <Card key={row.id}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                {i + 1}. {row.stage}
              </h3>
              {row.draft ? <Badge tone="neutral">Draft</Badge> : <Badge tone="ok">Confirmed</Badge>}
            </div>
            <div className="space-y-2">
              <Field label="What happens">
                <Textarea
                  value={row.happens}
                  onChange={(e) => update(row.id, { happens: e.target.value })}
                />
              </Field>
              <Field label="Who owns it">
                <Textarea
                  value={row.owner}
                  onChange={(e) => update(row.id, { owner: e.target.value })}
                />
              </Field>
              <Field label="Docs / approvals">
                <Textarea value={row.docs} onChange={(e) => update(row.id, { docs: e.target.value })} />
              </Field>
              <Field label="Where it stalls">
                <Textarea
                  value={row.stalls}
                  onChange={(e) => update(row.id, { stalls: e.target.value })}
                />
              </Field>
              <Field label="Tools now">
                <Textarea value={row.tools} onChange={(e) => update(row.id, { tools: e.target.value })} />
              </Field>
            </div>
            <Button
              variant={row.draft ? "ok" : "secondary"}
              className="mt-3 w-full"
              onClick={() => confirm(row.id, row.draft)}
            >
              {row.draft ? "Confirm stage" : "Back to draft"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
