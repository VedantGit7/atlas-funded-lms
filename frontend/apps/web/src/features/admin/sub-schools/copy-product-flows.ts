export type CopyProductKind = "course" | "mock-test" | "test-series";

export type CopySelectableItem = {
  id: string;
  label: string;
};

export type CopyProductFlowConfig = {
  kind: CopyProductKind;
  title: string;
  subtitle: string;
  breadcrumbLabel: string;
  primaryLabel: string;
  primaryPlaceholder: string;
  hasSections: boolean;
  sectionsLabel: string;
  sectionsPlaceholder: string;
  pathSegment: string;
  productNoun: string;
};

export const COPY_PRODUCT_FLOWS: Record<CopyProductKind, CopyProductFlowConfig> = {
  course: {
    kind: "course",
    title: "Copy Course",
    subtitle: "Select course you want to copy",
    breadcrumbLabel: "Copy Course",
    primaryLabel: "Select Course",
    primaryPlaceholder: "Select a course to copy",
    hasSections: true,
    sectionsLabel: "Select Sections",
    sectionsPlaceholder: "Select sections to copy",
    pathSegment: "course",
    productNoun: "Course",
  },
  "mock-test": {
    kind: "mock-test",
    title: "Copy Mock-Test",
    subtitle: "Select mock-test you want to copy",
    breadcrumbLabel: "Copy Mock-Test",
    primaryLabel: "Select Mock-Test",
    primaryPlaceholder: "Select a mock-test to copy",
    hasSections: false,
    sectionsLabel: "Select Sections",
    sectionsPlaceholder: "Select sections to copy",
    pathSegment: "mock-test",
    productNoun: "Mock-Test",
  },
  "test-series": {
    kind: "test-series",
    title: "Copy Test Series",
    subtitle: "Select test series you want to copy",
    breadcrumbLabel: "Copy Test Series",
    primaryLabel: "Select Test Series",
    primaryPlaceholder: "Select a test series to copy",
    hasSections: true,
    sectionsLabel: "Select Sections",
    sectionsPlaceholder: "Select sections to copy",
    pathSegment: "test-series",
    productNoun: "Test Series",
  },
};

export function toApiProductType(kind: CopyProductKind): "COURSE" | "MOCK_TEST" | "TEST_SERIES" {
  if (kind === "course") return "COURSE";
  if (kind === "mock-test") return "MOCK_TEST";
  return "TEST_SERIES";
}

export function subSchoolCopyFlowHref(subSchoolId: string, kind: CopyProductKind): string {
  const segment = COPY_PRODUCT_FLOWS[kind].pathSegment;
  return `/admin/sub-schools/${subSchoolId}/copy-product/${segment}`;
}
