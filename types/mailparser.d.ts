declare module 'mailparser' {
  export interface ParsedMailAttachment {
    filename?: string
    size?: number
  }

  export interface ParsedMail {
    subject?: string
    from?: { text?: string }
    date?: Date
    attachments?: ParsedMailAttachment[]
  }

  export function simpleParser(source: Buffer | string): Promise<ParsedMail>
}
