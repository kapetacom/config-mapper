import * as Path from 'node:path';
import {
    createAttachmentFromFile,
    getAttachment,
    getAttachmentContent,
    readAttachmentContent,
    setAttachment,
    writeAttachmentContent,
} from '../src/attachments';
import { AttachmentContentFormat } from '@kapeta/schemas';

const SimpleKind = {
    kind: 'kind',
    spec: {},
    metadata: {
        name: 'some/name',
    },
    attachments: [
        {
            filename: 'file.txt',
            contentType: 'contentType',
            content: {
                format: AttachmentContentFormat.Plain,
                value: 'value',
            },
        },
    ],
};

describe('attachments', () => {
    it('can get attachment from kind', () => {
        expect(getAttachment(SimpleKind, 'file.txt')).toBeTruthy();
        expect(getAttachment(SimpleKind, 'other.txt')).toBeNull();
    });

    it('can get attachment content from kind', async () => {
        const content = await getAttachmentContent(SimpleKind, 'file.txt');
        expect(content).toBeDefined();
        expect(content?.toString()).toBe('value');
    });

    it('can create attachment content', async () => {
        const valueBuf = Buffer.from('value');
        expect(await writeAttachmentContent(AttachmentContentFormat.Plain, valueBuf)).toEqual('value');
        expect(
            await writeAttachmentContent(AttachmentContentFormat.URL, Buffer.from('https://kapeta.com/robots.txt'))
        ).toBe('https://kapeta.com/robots.txt');
        expect(await writeAttachmentContent(AttachmentContentFormat.Base64, valueBuf)).toEqual('dmFsdWU=');
        expect(await writeAttachmentContent(AttachmentContentFormat.Base64Gzip, valueBuf)).toEqual(
            'H4sIAAAAAAAAEytLzClNBQA0WHcdBQAAAA=='
        );
    });

    it('can read attachment content', async () => {
        const valueBuf = Buffer.from('value');
        expect(await readAttachmentContent(AttachmentContentFormat.Plain, 'value')).toEqual(valueBuf);
        expect(await readAttachmentContent(AttachmentContentFormat.URL, 'https://kapeta.com/robots.txt')).toBeDefined();
        expect(await readAttachmentContent(AttachmentContentFormat.Base64, 'dmFsdWU=')).toEqual(valueBuf);
        expect(
            await readAttachmentContent(AttachmentContentFormat.Base64Gzip, 'H4sIAAAAAAAAEytLzClNBQA0WHcdBQAAAA==')
        ).toEqual(valueBuf);
    });

    it('can create attachment from file', async () => {
        const attachment = await createAttachmentFromFile(Path.join(__dirname, 'files/test.txt'), 'text/plain');

        expect(attachment).toBeDefined();
        expect(attachment.filename).toBe('test.txt');
        expect(attachment.contentType).toBe('text/plain');
        expect(attachment.content.format).toBe(AttachmentContentFormat.Base64Gzip);
        expect(attachment.content.value).toBe('H4sIAAAAAAAAEytLzClNBQA0WHcdBQAAAA==');
    });

    it('can create attachment from file in specific format', async () => {
        const attachment = await createAttachmentFromFile(
            Path.join(__dirname, 'files/test.txt'),
            'text/plain',
            AttachmentContentFormat.Plain
        );

        expect(attachment).toBeDefined();
        expect(attachment.filename).toBe('test.txt');
        expect(attachment.contentType).toBe('text/plain');
        expect(attachment.content.format).toBe(AttachmentContentFormat.Plain);
        expect(attachment.content.value).toBe('value');
    });

    it('can set attachment on kind', async () => {
        const copy = { ...SimpleKind, attachments: [...SimpleKind.attachments] };
        const attachment = await createAttachmentFromFile(Path.join(__dirname, 'files/test.txt'), 'text/plain');
        expect(getAttachment(copy, attachment.filename)).toBeNull();
        expect(copy.attachments.length).toBe(1);

        // It adds the attachment if it doesn't exist
        setAttachment(copy, attachment);
        expect(getAttachment(copy, attachment.filename)).toBeDefined();
        expect(copy.attachments.length).toBe(2);

        // It replaces the attachment if it already exists
        setAttachment(copy, attachment);
        expect(copy.attachments.length).toBe(2);
    });
});
