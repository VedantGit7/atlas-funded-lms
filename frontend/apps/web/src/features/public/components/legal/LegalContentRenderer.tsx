import type { LegalContentBlock } from "./legal-types";

const proseClass = "text-[15px] leading-[1.75] text-[var(--fba-tx2)]";
const headingClass = "mb-3 mt-6 text-[17px] font-bold text-[var(--fba-tx)] first:mt-0";

export function LegalContentRenderer({ blocks }: { blocks: LegalContentBlock[] }) {
  return (
    <div className="space-y-4">
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
              <ul key={index} className={`${proseClass} list-disc space-y-2 pl-5`}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={index} className={`${proseClass} list-decimal space-y-2 pl-5`}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div
                key={index}
                className="overflow-x-auto rounded-[10px] border border-[var(--fba-bdr)]"
              >
                <table className="w-full min-w-[480px] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-[var(--fba-bdr)] bg-[var(--fba-bg2)]">
                      {block.headers.map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold text-[var(--fba-tx)]">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr
                        key={row.join("-")}
                        className={
                          rowIndex % 2 === 1 ? "bg-[var(--fba-bg2)]/40" : "bg-[var(--fba-surf)]"
                        }
                      >
                        {row.map((cell) => (
                          <td
                            key={cell}
                            className="border-t border-[var(--fba-bdr)] px-4 py-3 text-[var(--fba-tx2)]"
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
