#!/usr/bin/env python3
"""
Script to check for PersonID patterns in the data
"""

import pyreadstat
import pandas as pd
import os
import glob
import subprocess
import sys

def check_personid_patterns(stata_file):
    """
    Look for PersonID patterns in the data
    """
    
    # Read the Stata file
    df, meta = pyreadstat.read_dta(stata_file)
    
    print("Checking for PersonID patterns in the data...\n")
    
    # Look at combinations that might form a unique person ID
    print("=" * 80)
    print("CHECKING COMBINATIONS THAT MIGHT FORM A PERSON ID")
    print("=" * 80)
    
    # Check if combining surname + given name + other fields creates unique IDs
    if '姓' in df.columns and '名' in df.columns:
        # Create a combined name field
        df['full_name'] = df['姓'].astype(str) + df['名'].astype(str)
        
        # Count unique combinations
        print(f"\nTotal records: {len(df)}")
        print(f"Unique full names (姓+名): {df['full_name'].nunique()}")
        print(f"Duplicate ratio: {1 - (df['full_name'].nunique() / len(df)):.2%}")
        
        # Check if adding other fields makes it more unique
        if '原籍省' in df.columns and '原籍县' in df.columns:
            df['name_origin'] = df['full_name'] + '_' + df['原籍省'].astype(str) + '_' + df['原籍县'].astype(str)
            print(f"Unique name+origin combinations: {df['name_origin'].nunique()}")
            print(f"Duplicate ratio: {1 - (df['name_origin'].nunique() / len(df)):.2%}")
        
        # Show some examples of duplicated names
        duplicated_names = df[df['full_name'].duplicated(keep=False)].sort_values('full_name')
        if not duplicated_names.empty:
            print("\nExamples of duplicated names:")
            sample_name = duplicated_names['full_name'].iloc[0]
            sample_records = df[df['full_name'] == sample_name].head(5)
            print(f"\nRecords with name '{sample_name}':")
            print(sample_records[['阳历年份', '姓', '名', '官职一', '地区', '原籍省', '原籍县']].to_string())
    
    # Check the record_number field
    print("\n" + "=" * 80)
    print("ANALYZING RECORD_NUMBER FIELD")
    print("=" * 80)
    
    if 'record_number' in df.columns:
        print(f"Record number range: {df['record_number'].min()} to {df['record_number'].max()}")
        print(f"Unique record numbers: {df['record_number'].nunique()}")
        print(f"Is record_number unique? {df['record_number'].nunique() == len(df)}")
        
        # Check if record_number is sequential or has patterns
        df_sorted = df.sort_values('record_number')
        print("\nFirst 10 record numbers:")
        print(df_sorted['record_number'].head(10).tolist())
        
        # Check if it resets by year
        if '阳历年份' in df.columns:
            year_groups = df.groupby('阳历年份')['record_number'].agg(['min', 'max', 'count'])
            print("\nRecord number ranges by year (first 5 years):")
            print(year_groups.head())
    
    # Check 序号 (sequence number) field
    print("\n" + "=" * 80)
    print("ANALYZING 序号 (SEQUENCE NUMBER) FIELD")
    print("=" * 80)
    
    if '序号' in df.columns:
        print(f"序号 range: {df['序号'].min()} to {df['序号'].max()}")
        print(f"Unique 序号 values: {df['序号'].nunique()}")
        
        # Check if 序号 repeats within years/seasons
        if '阳历年份' in df.columns and '季节号' in df.columns:
            grouped = df.groupby(['阳历年份', '季节号'])['序号'].agg(['min', 'max', 'nunique', 'count'])
            print("\n序号 patterns by year and season (first 5):")
            print(grouped.head())
    
    # Look for any hidden ID patterns in the data
    print("\n" + "=" * 80)
    print("SEARCHING FOR HIDDEN ID PATTERNS")
    print("=" * 80)
    
    # Check if there's a pattern in how officials appear across different years
    if '姓' in df.columns and '名' in df.columns and '阳历年份' in df.columns:
        # Find officials who appear in multiple years
        df['full_name'] = df['姓'].astype(str) + df['名'].astype(str)
        name_year_counts = df.groupby('full_name')['阳历年份'].nunique().sort_values(ascending=False)
        
        print("\nOfficials appearing in multiple years (top 10):")
        for name, year_count in name_year_counts.head(10).items():
            years = df[df['full_name'] == name]['阳历年份'].unique()
            print(f"{name}: appears in {year_count} years - {sorted(years)[:5]}{'...' if len(years) > 5 else ''}")

def install_questionary():
    """Install questionary if not available"""
    try:
        import questionary
    except ImportError:
        print("Installing questionary...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "questionary"])
        import questionary
    return questionary

def select_stata_file():
    """Let user select a .dta file from dta/ directory"""
    dta_dir = "dta"
    if not os.path.exists(dta_dir):
        print(f"Directory {dta_dir}/ not found.")
        return None
    
    dta_files = glob.glob(os.path.join(dta_dir, "*.dta"))
    
    if not dta_files:
        print("No .dta files found in dta/ directory.")
        return None
    
    questionary = install_questionary()
    
    file_choices = [os.path.basename(f) for f in dta_files]
    selected = questionary.select(
        "Select a .dta file to check for PersonID patterns:",
        choices=file_choices
    ).ask()
    
    if not selected:
        return None
    
    return os.path.join(dta_dir, selected)

if __name__ == "__main__":
    stata_file = select_stata_file()
    if stata_file:
        check_personid_patterns(stata_file)
    else:
        print("No file selected. Exiting.")