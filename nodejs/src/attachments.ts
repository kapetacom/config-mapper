import { Attachment, AttachmentContentFormat, Kind } from '@kapeta/schemas';
import * as zlib from 'node:zlib';
import * as util from 'node:util';
import * as Path from 'node:path';
import * as FS from 'node:fs/promises';

const gzip = util.promisify(zlib.gzip);
const gunzip = util.promisify(zlib.gunzip);

export function getAttachment(kind: Kind, filename: string) {
    if (!kind.attachments) {
        return null;
    }
    return kind.attachments.find((a) => a.filename === filename) || null;
}

export function setAttachment(kind: Kind, attachment: Attachment) {
    if (!kind.attachments) {
        kind.attachments = [];
    }

    const ix = kind.attachments.findIndex((a) => a.filename === attachment.filename);
    if (ix >= 0) {
        kind.attachments[ix] = attachment;
        return;
    } else {
        kind.attachments.push(attachment);
    }
}

export async function getAttachmentContent(kind: Kind, filename: string) {
    const attachment = getAttachment(kind, filename);
    if (!attachment) {
        return null;
    }
    return readAttachmentContent(attachment.content.format, attachment.content.value);
}

export async function readAttachmentContent(format: AttachmentContentFormat, value: string) {
    switch (format) {
        case AttachmentContentFormat.Base64:
            return Buffer.from(value, 'base64');
        case AttachmentContentFormat.Plain:
            return Buffer.from(value, 'utf-8');
        case AttachmentContentFormat.Base64Gzip:
            const gzipped = Buffer.from(value, 'base64');
            return await gunzip(gzipped, {
                level: zlib.constants.Z_BEST_COMPRESSION,
            });
        case AttachmentContentFormat.URL:
            return fetch(value)
                .then((res) => res.arrayBuffer())
                .then((buffer) => Buffer.from(buffer));
    }
}

export async function createAttachmentFromFile(
    path: string,
    contentType: string,
    format: AttachmentContentFormat = AttachmentContentFormat.Base64Gzip
): Promise<Attachment> {
    const filename = Path.basename(path);

    const content = await FS.readFile(path);

    return createAttachment(filename, contentType, format, content);
}

export async function createAttachment(
    filename: string,
    contentType: string,
    format: AttachmentContentFormat,
    content: Buffer
): Promise<Attachment> {
    return {
        filename,
        contentType,
        content: {
            format,
            value: await writeAttachmentContent(format, content),
        },
    };
}

export async function writeAttachmentContent(format: AttachmentContentFormat, content: Buffer): Promise<string> {
    switch (format) {
        case AttachmentContentFormat.Base64:
            return content.toString('base64');
        case AttachmentContentFormat.Plain:
            return content.toString();
        case AttachmentContentFormat.Base64Gzip:
            const gzipped = await gzip(content, {
                level: zlib.constants.Z_BEST_COMPRESSION,
            });
            return gzipped.toString('base64');
        case AttachmentContentFormat.URL:
            return content.toString();
    }
}
