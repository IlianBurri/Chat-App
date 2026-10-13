import clsx from 'clsx';
import { Fragment, useMemo } from 'react';
import { parseMarkdown, type Block, type Inline, type MentionTarget } from '@/lib/markdown';

interface MarkdownProps {
  source: string;
  mentions?: MentionTarget[];
  meId?: string;
  className?: string;
}

/** Renders the message markdown subset as React elements (no raw HTML). */
export function Markdown({ source, mentions = [], meId, className }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(source, mentions), [source, mentions]);
  return (
    <div className={clsx('space-y-1.5 break-words [overflow-wrap:anywhere]', className)}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} meId={meId} />
      ))}
    </div>
  );
}

function BlockView({ block, meId }: { block: Block; meId?: string }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <p>
          <Inlines nodes={block.children} meId={meId} />
        </p>
      );
    case 'heading': {
      const Heading = (['h3', 'h4', 'h5'] as const)[block.level - 1];
      const size = block.level === 1 ? 'text-lg' : block.level === 2 ? 'text-base' : 'text-sm';
      return (
        <Heading className={clsx('leading-snug font-semibold', size)}>
          <Inlines nodes={block.children} meId={meId} />
        </Heading>
      );
    }
    case 'codeblock':
      return (
        <pre className="overflow-x-auto rounded-md bg-black/5 p-2 font-mono text-[13px] leading-snug dark:bg-white/10">
          <code>{block.text}</code>
        </pre>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className={clsx('space-y-0.5 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((item, i) => (
            <li key={i}>
              <Inlines nodes={item} meId={meId} />
            </li>
          ))}
        </List>
      );
    }
    case 'quote':
      return (
        <blockquote className="border-l-[3px] border-line pl-2.5 text-muted">
          <Inlines nodes={block.children} meId={meId} />
        </blockquote>
      );
  }
}

function Inlines({ nodes, meId }: { nodes: Inline[]; meId?: string }) {
  return (
    <>
      {nodes.map((node, i) => (
        <Fragment key={i}>{renderInline(node, meId)}</Fragment>
      ))}
    </>
  );
}

function renderInline(node: Inline, meId?: string) {
  switch (node.type) {
    case 'text':
      return node.text;
    case 'br':
      return <br />;
    case 'bold':
      return (
        <strong className="font-semibold">
          <Inlines nodes={node.children} meId={meId} />
        </strong>
      );
    case 'italic':
      return (
        <em>
          <Inlines nodes={node.children} meId={meId} />
        </em>
      );
    case 'strike':
      return (
        <s>
          <Inlines nodes={node.children} meId={meId} />
        </s>
      );
    case 'code':
      return <code className="rounded bg-black/5 px-1 py-px font-mono text-[13px] dark:bg-white/10">{node.text}</code>;
    case 'link':
      return (
        <a href={node.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:no-underline">
          <Inlines nodes={node.children} meId={meId} />
        </a>
      );
    case 'mention':
      return (
        <span
          className={clsx(
            'rounded px-0.5 font-semibold',
            node.userId === meId ? 'bg-accent text-accent-fg' : 'text-accent',
          )}
        >
          @{node.name}
        </span>
      );
  }
}
