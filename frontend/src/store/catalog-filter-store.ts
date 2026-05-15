'use client';

import { create } from 'zustand';

interface CatalogFilterState {
    mobileFiltersOpen: boolean;
    setMobileFiltersOpen: (open: boolean) => void;
}

export const useCatalogFilterStore = create<CatalogFilterState>((set) => ({
    mobileFiltersOpen: false,
    setMobileFiltersOpen: (open) => set({ mobileFiltersOpen: open }),
}));