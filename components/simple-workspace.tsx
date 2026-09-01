'use client';

import {
  SearchWorkbench,
  type SearchRecord,
} from '@/components/search-workbench';

type SimpleWorkspaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{ id: string; title: string; body: string }>;
};

export function SimpleWorkspace({
  eyebrow,
  title,
  description,
  cards,
}: SimpleWorkspaceProps) {
  const records: SearchRecord[] = cards.map((card) => ({
    id: card.id,
    title: card.title,
    subtitle: card.body,
    text: `${card.title} ${card.body}`,
  }));
  return (
    <section
      className="simple-workspace"
      aria-labelledby={`${cards[0]?.id ?? 'simple'}-heading`}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h1
        className="workspace-title"
        id={`${cards[0]?.id ?? 'simple'}-heading`}
      >
        {title}
      </h1>
      <p className="lede">{description}</p>
      <SearchWorkbench
        surfaceId={`workspace-${cards[0]?.id ?? 'simple'}-search`}
        label={`Search ${title}`}
        placeholder="Find an item in this view"
        records={records}
        onActivate={(record) => document.getElementById(record.id)?.focus()}
      />
      <div className="status-card-grid">
        {cards.map((card) => (
          <article id={card.id} tabIndex={-1} key={card.id}>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
