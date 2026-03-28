import standardCsv from "./standard.csv";
import withIssuesCsv from "./with-issues.csv";
import akamaiCsv from "./akamai.csv";
import htaccess from "./.htaccess";

export interface CsvExample {
  id: string;
  name: string;
  description: string;
  presetId?: string;
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
    fileName: "example-standard.csv",
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
