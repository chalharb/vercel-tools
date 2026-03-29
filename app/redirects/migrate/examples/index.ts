import standardCsv from "./standard.csv";
import withExtrasCsv from "./with-extras.csv";
import withIssuesCsv from "./with-issues.csv";
import akamaiCsv from "./akamai.csv";
import htaccess from "./.htaccess";
import type { ResolvedMapping } from "../_components/column-mapping-dialog";

export interface CsvExample {
  id: string;
  name: string;
  description: string;
  presetId?: string;
  /** Pre-populate the Column Mapping dialog with this mapping when the example is loaded. */
  mappingHint?: ResolvedMapping;
  content: string;
  fileName: string;
  toCsv?: (raw: string) => string;
}

export const CSV_EXAMPLES: CsvExample[] = [
  {
    id: "standard",
    name: "Standard CSV",
    description: "Clean CSV — source, destination, statusCode",
    presetId: "standard",
    content: standardCsv,
    fileName: "standard.csv",
  },
  {
    id: "with-extras",
    name: "CSV with Extras",
    description: "Split columns — combine scheme, domain, path into source",
    content: withExtrasCsv,
    fileName: "with-extras.csv",
    mappingHint: {
      kind: "custom",
      mapping: {
        source: {
          columns: ["scheme", "domain", "path"],
          separators: ["://", ""],
        },
        destination: { columns: ["destination"], separators: [] },
        statusCode: "statusCode",
      },
    },
  },
  {
    id: "with-issues",
    name: "CSV with Issues",
    description: "Duplicates, conflicts, and trailing slashes",
    presetId: "standard",
    content: withIssuesCsv,
    fileName: "example-with-issues.csv",
  },
  {
    id: "akamai",
    name: "Akamai CSV",
    description: "Akamai Edge Redirector export with comments",
    presetId: "akamai",
    content: akamaiCsv,
    fileName: "example-akamai.csv",
  },
  {
    id: "htaccess",
    name: ".htaccess",
    description: "Apache RewriteRule and Redirect directives",
    presetId: "htaccess",
    content: htaccess,
    fileName: ".htaccess",
  },
];
