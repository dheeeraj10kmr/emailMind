import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DataContextType {
  // Add any shared data state here if needed in the future
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const refreshData = () => {
    // Placeholder for future data refresh functionality
    console.log('Data refresh triggered');
  };

  return (
    <DataContext.Provider value={{ refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}