import type { LegalContentBlock } from "./legal-types";

// Compact, plain legal text (launch plan 5.7): small type, tight spacing.
const proseClass = "text-[14px] leading-[1.6] text-[var(--fba-tx2)]";
const headingClass = "mt-3 text-[14px] font-semibold text-[var(--fba-tx)] first:mt-0";

export function LegalContentRenderer({ blocks }: { blocks: LegalContentBlock[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index} className={proseClass}>
                {block.text}
              </p>
            );
          case "h3":
            return (
              <h3 key={index} className={headingClass}>
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={index} className={`${proseClass} list-disc space-y-1 pl-5`}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className={`${proseClass} list-decimal space-y-1 pl-5`}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={index} className="overflow-x-auto border border-[var(--fba-bdr)]">
                <table className="w-full min-w-[480px] border-collapse text-left text-[13px] leading-[1.5]">
                  <thead>
                    <tr className="border-b border-[var(--fba-bdr)] bg-[var(--fba-bg2)]">
                      {block.headers.map((header) => (
                        <th key={header} className="px-3 py-1.5 font-semibold text-[var(--fba-tx)]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join("-")} className="bg-[var(--fba-surf)] align-top">
                        {row.map((cell) => (
                          <td
                            key={cell}
                            className="border-t border-[var(--fba-bdr)] px-3 py-1.5 text-[var(--fba-tx2)]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
