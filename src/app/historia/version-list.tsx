import { ACTION_LABELS, type Version } from "@/lib/audit/history";
import { formatVisitDate } from "@/lib/visits/time";
import { RestoreVersionButton } from "./restore-button";

/** Lista wersji od najnowszej: kto, kiedy, co się zmieniło (przed → po) i „Przywróć tę wersję”. */
export function VersionList({
  versions,
  names,
  path,
  restorable = true,
}: {
  versions: Version[];
  names: Map<string, string>;
  path: string;
  restorable?: boolean;
}) {
  if (versions.length === 0) {
    return <p className="rounded-xl bg-foreground/5 px-4 py-3 text-sm text-foreground/70">Brak zmian.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((v) => (
        <li key={v.auditId} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
          <p className="text-sm">
            <span className="font-semibold">{ACTION_LABELS[v.action]}</span>
            <span className="text-foreground/60">
              {" "}
              · {formatVisitDate(v.createdAt, true)} · {(v.createdBy && names.get(v.createdBy)) || "system"}
            </span>
          </p>
          {v.changes.length > 0 && (
            <dl className="flex flex-col gap-1.5 text-sm">
              {v.changes.map((c) => (
                <div key={c.key}>
                  <dt className="text-foreground/60">{c.label}</dt>
                  <dd className="whitespace-pre-wrap">
                    <span className="line-through decoration-red-600/60">{c.before}</span>
                    {" → "}
                    <span>{c.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {restorable && v.action !== "delete" && v.action !== "restore" && (
            <RestoreVersionButton auditId={v.auditId} path={path} />
          )}
        </li>
      ))}
    </ol>
  );
}
