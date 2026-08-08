export type PageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ItemTypeDto = {
  key: string;
  name: string;
  pointType?: string;
  schemaJson: unknown;
  status: string;
};

export type ItemOptionDto = {
  id: string;
  optionJson: unknown;
  isCorrect: boolean | null;
  position: number;
};

export type ItemDto = {
  id: string;
  itemTypeKey: string;
  contentJson: unknown;
  answerKeyJson: unknown;
  status: string;
  tags: string[];
  metadataJson: unknown;
  createdByMembershipId: string;
  createdAt: string;
  updatedAt: string;
  options?: ItemOptionDto[];
};

export type ItemListDto = {
  data: ItemDto[];
  page: PageInfo;
};

export type DimensionWeightDto = {
  id: string;
  itemId: string;
  dimensionId: string;
  weight: string;
};

export type ItemCollectionDto = {
  id: string;
  slug: string;
  title: string;
  collectionType: "deck" | "quiz_bank" | "practice_set";
  status: string;
  metadataJson: unknown;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
};

export type ItemCollectionItemDto = {
  id: string;
  collectionId: string;
  itemId: string;
  position: number;
  weight: string | null;
  item?: ItemDto;
};

export type ItemCollectionListDto = {
  data: ItemCollectionDto[];
  page: PageInfo;
};
