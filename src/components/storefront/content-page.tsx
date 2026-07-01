export function ContentPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-muted-foreground">
        {body.split("\n").map((line, i) =>
          line.trim() ? <p key={i}>{line}</p> : <br key={i} />
        )}
      </div>
    </div>
  );
}
