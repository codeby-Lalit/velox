import { Fingerprint, FileText, User, CalendarDays } from "lucide-react";

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right font-mono text-xs text-slate-300">{children}</span>
    </div>
  );
}

export default function MetaPanel({ payload }) {
  const source = payload?.source ?? {};
  const meta = source.metadata ?? {};
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-aqua-400/10">
          <Fingerprint className="h-4 w-4 text-aqua-300" />
        </span>
        <h4 className="text-sm font-semibold text-white">Source fingerprint</h4>
      </div>
      <p className="break-all rounded-lg bg-ink-950/60 px-3 py-2 font-mono text-[10px] leading-relaxed text-slate-400">
        {source.sha256 || "—"}
      </p>

      <div className="mt-4 border-t border-line" />
      <Row label="File">
        <span className="flex items-center gap-1.5 normal-case">
          <FileText className="h-3 w-3" /> {source.path?.split(/[\\/]/).pop() || "—"}
        </span>
      </Row>
      <Row label="Size">{source.size_bytes?.toLocaleString()} B</Row>
      <Row label="Title">
        <span className="normal-case">{meta.title || "—"}</span>
      </Row>
      <Row label="Author">
        <span className="flex items-center gap-1.5 normal-case">
          <User className="h-3 w-3" /> {meta.author || "—"}
        </span>
      </Row>
      <Row label="Created">
        <span className="flex items-center gap-1.5 normal-case">
          <CalendarDays className="h-3 w-3" /> {meta.created || "—"}
        </span>
      </Row>
      <Row label="Engine">
        <span className="normal-case">
          {payload.engine?.name} {payload.engine?.version}
        </span>
      </Row>

      {(source.headers?.length || source.footers?.length) && (
        <>
          <div className="mt-4 border-t border-line" />
          <div className="py-2">
            <p className="text-xs font-medium text-slate-400">Headers & footers (F002)</p>
            {source.headers?.map((h, i) => (
              <p key={`h-${i}`} className="mt-1 truncate font-mono text-[10px] text-slate-500">
                HDR · {h}
              </p>
            ))}
            {source.footers?.map((f, i) => (
              <p key={`f-${i}`} className="mt-1 truncate font-mono text-[10px] text-slate-500">
                FTR · {f}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}