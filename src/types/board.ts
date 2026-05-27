export interface CommentDTO {
  id: string;
  cardId: string;
  text: string;
  authorName: string | null;
  authorId: string | null;
  createdAt: string;
}

export interface AttachmentDTO {
  id: string;
  cardId: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CardDTO {
  id: string;
  columnId: string;
  title: string;
  body: string;
  sortOrder: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  comments: CommentDTO[];
  attachments: AttachmentDTO[];
}

export interface ColumnDTO {
  id: string;
  boardId: string;
  name: string;
  color: string;
  sortOrder: string;
  wipLimit: number | null;
  cards: CardDTO[];
}

export interface BoardDTO {
  id: string;
  name: string;
  columns: ColumnDTO[];
}
