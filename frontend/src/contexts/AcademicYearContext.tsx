import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { getCurrentAcademicYear } from "@/lib/academic-year";

interface AcademicYearContextType {
  currentAcademicYear: string;
  isLoading: boolean;
  refreshAcademicYear: () => Promise<string>;
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export const AcademicYearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentAcademicYear, setCurrentAcademicYear] = useState<string>(getCurrentAcademicYear());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchAcademicYear = async (): Promise<string> => {
    try {
      const response = await apiFetch("/api/academic-year/current");
      if (response.ok) {
        const data = await response.json();
        if (data.current_academic_year) {
          setCurrentAcademicYear(data.current_academic_year);
          return data.current_academic_year;
        }
      }
    } catch (error) {
      console.error("Failed to fetch academic year from API, using fallback:", error);
    }
    const fallback = getCurrentAcademicYear();
    setCurrentAcademicYear(fallback);
    return fallback;
  };

  const refreshAcademicYear = async () => {
    setIsLoading(true);
    const year = await fetchAcademicYear();
    setIsLoading(false);
    return year;
  };

  useEffect(() => {
    refreshAcademicYear();
  }, []);

  return (
    <AcademicYearContext.Provider value={{ currentAcademicYear, isLoading, refreshAcademicYear }}>
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error("useAcademicYear must be used within an AcademicYearProvider");
  }
  return context;
};
