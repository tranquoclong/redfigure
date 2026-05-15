import { BadRequestException } from '@nestjs/common';
import {
    validateAndNormalizeBlocks,
    parseStoredBlocks,
} from './home-blocks.validator';

describe('home-blocks.validator — defense against dynamic dispatch (CodeQL #220)', () => {
    const validBlock = {
        id: 'cs1',
        type: 'categories-strip',
        isActive: true,
        order: 0,
        data: { eyebrow: 'Eyebrow', title: 'Title' },
    };

    describe('validateAndNormalizeBlocks — admin write path', () => {
        it('accepts valid type + valid data (sanity)', () => {
            const result = validateAndNormalizeBlocks([validBlock] as never);
            expect(result.blocks).toHaveLength(1);
            expect(result.blocks[0].type).toBe('categories-strip');
        });

        it('rejects unknown string type with 400', () => {
            expect(() =>
                validateAndNormalizeBlocks([
                    { ...validBlock, type: 'fake-block' },
                ] as never),
            ).toThrow(BadRequestException);
        });

        const PROTO_ATTACK_TYPES = [
            '__proto__',
            'hasOwnProperty',
            'valueOf',
            'constructor',
            'toString',
            '__defineGetter__',
        ];
        for (const attackType of PROTO_ATTACK_TYPES) {
            it(`rejects attempt to invoke Object.prototype method: '${attackType}'`, () => {
                expect(() =>
                    validateAndNormalizeBlocks([
                        { ...validBlock, type: attackType },
                    ] as never),
                ).toThrow(BadRequestException);
            });
        }

        it('rejects non-string type (number)', () => {
            expect(() =>
                validateAndNormalizeBlocks([{ ...validBlock, type: 42 }] as never),
            ).toThrow(BadRequestException);
        });
    });

    describe('parseStoredBlocks — DB read path (lenient: drop with warn)', () => {
        it('accepts valid type + valid data', () => {
            const result = parseStoredBlocks({ blocks: [validBlock] });
            expect(result?.blocks).toHaveLength(1);
        });

        it('drops unknown type without throw (with warn)', () => {
            const onWarn = jest.fn();
            const result = parseStoredBlocks(
                { blocks: [{ ...validBlock, type: 'fake-block' }] },
                { onWarn },
            );
            expect(result?.blocks).toHaveLength(0);
            expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('fake-block'));
        });

        it('drops prototype-attack type without invoking inherited method', () => {
            const onWarn = jest.fn();
            const result = parseStoredBlocks(
                { blocks: [{ ...validBlock, type: '__proto__' }] },
                { onWarn },
            );
            expect(result?.blocks).toHaveLength(0);
            expect(onWarn).toHaveBeenCalledWith(expect.stringContaining('__proto__'));
        });
    });
});