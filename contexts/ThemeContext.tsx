import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CompanyTheme {
    companyId: string;
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
}

export const companyThemes: Record<string, CompanyTheme> = {
    'internal': {
        companyId: 'internal',
        companyName: 'Eletromidia',
        primaryColor: '#FF4F00', // Official Eletromidia Brand Orange
        secondaryColor: '#4E18FF', // Official Eletromidia Accent Purple
        logoUrl: '/eletromidia/Eletromidia%20Horizontal%20(3).png'
    },
    'bassi': {
        companyId: 'bassi',
        companyName: 'Bassi',
        primaryColor: '#5B9BD5',
        secondaryColor: '#2B579A',
        logoUrl: 'https://gvlhjjonhwhifxomwpgu.supabase.co/storage/v1/object/public/assets/LOGO%20BASSI.png'
    },
    'silva': {
        companyId: 'silva',
        companyName: 'Silva',
        primaryColor: '#00B050',
        secondaryColor: '#1E1E1E',
    },
    'alvares': {
        companyId: 'alvares',
        companyName: 'Alvares',
        primaryColor: '#833C0C',
        secondaryColor: '#ED7D31',
    }
};

interface ThemeContextType {
    theme: CompanyTheme;
    setCompanyById: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: companyThemes['internal'],
    setCompanyById: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode; companyId?: string }> = ({ children, companyId = 'internal' }) => {
    const [theme, setTheme] = useState<CompanyTheme>(companyThemes[companyId] || companyThemes['internal']);

    useEffect(() => {
        const selectedTheme = companyThemes[companyId.toLowerCase()] || companyThemes['internal'];
        setTheme(selectedTheme);

        document.documentElement.style.setProperty('--color-primary', selectedTheme.primaryColor);
        document.documentElement.style.setProperty('--color-secondary', selectedTheme.secondaryColor);

        if ((window as any).tailwind) {
            (window as any).tailwind.config = {
                darkMode: 'class',
                theme: {
                    extend: {
                        fontFamily: {
                            sans: ['"Rethink Sans"', 'system-ui', 'Arial', 'Helvetica', 'sans-serif'],
                            display: ['"Rethink Sans"', 'system-ui', 'Arial', 'Helvetica', 'sans-serif'],
                            mono: ['"JetBrains Mono"', 'monospace'],
                        },
                        colors: {
                            primary: {
                                DEFAULT: selectedTheme.primaryColor,
                                50: `${selectedTheme.primaryColor}10`,
                                100: `${selectedTheme.primaryColor}20`,
                                200: `${selectedTheme.primaryColor}30`,
                                300: `${selectedTheme.primaryColor}40`,
                                400: `${selectedTheme.primaryColor}60`,
                                500: selectedTheme.primaryColor,
                                600: selectedTheme.primaryColor,
                                700: selectedTheme.primaryColor,
                            },
                            secondary: selectedTheme.secondaryColor,
                            eletro: {
                                orange: '#FF4F00',
                                black: '#000000',
                                white: '#FFFFFF',
                                purple: '#4E18FF',
                                yellow: '#FECC14',
                                pink: '#F577ED',
                                green: '#3D7700',
                            }
                        },
                        borderRadius: {
                            sm: '4px',
                            md: '12px',
                            xl: '12px',
                            '2xl': '16px',
                            '3xl': '20px',
                        }
                    }
                }
            };
        }
    }, [companyId]);

    const setCompanyById = (id: string) => {
        const selected = companyThemes[id.toLowerCase()] || companyThemes['internal'];
        setTheme(selected);
    };

    return (
        <ThemeContext.Provider value={{ theme, setCompanyById }}>
            {children}
        </ThemeContext.Provider>
    );
};
