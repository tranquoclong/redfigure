import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogFilterStore } from './catalog-filter-store';

describe('useCatalogFilterStore', () => {
    beforeEach(() => {
        useCatalogFilterStore.setState({ mobileFiltersOpen: false });
    });

    it('initial state: closed', () => {
        expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(false);
    });

    it('setMobileFiltersOpen(true) opens', () => {
        useCatalogFilterStore.getState().setMobileFiltersOpen(true);
        expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(true);
    });

    it('setMobileFiltersOpen(false) closes', () => {
        useCatalogFilterStore.setState({ mobileFiltersOpen: true });
        useCatalogFilterStore.getState().setMobileFiltersOpen(false);
        expect(useCatalogFilterStore.getState().mobileFiltersOpen).toBe(false);
    });
});