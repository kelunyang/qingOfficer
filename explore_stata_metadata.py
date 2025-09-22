#!/usr/bin/env python3
"""
Script to explore Stata file metadata and search for PersonID field
"""

import pyreadstat
import pandas as pd
import sys
import os
import glob
import subprocess

def explore_stata_file(file_path):
    """
    Comprehensive exploration of Stata file metadata
    """
    print(f"Exploring Stata file: {file_path}\n")
    
    try:
        # Read the Stata file with metadata
        df, meta = pyreadstat.read_dta(file_path)
        
        print("=" * 80)
        print("FILE INFORMATION")
        print("=" * 80)
        print(f"Number of rows: {len(df)}")
        print(f"Number of columns: {len(df.columns)}")
        print(f"File label: {getattr(meta, 'file_label', 'Not available')}")
        print(f"File encoding: {getattr(meta, 'file_encoding', 'Not available')}")
        
        print("\n" + "=" * 80)
        print("ALL COLUMN NAMES")
        print("=" * 80)
        for i, col in enumerate(df.columns):
            print(f"{i+1:3d}. {col}")
        
        print("\n" + "=" * 80)
        print("VARIABLE LABELS")
        print("=" * 80)
        if meta.column_names_to_labels:
            for var, label in meta.column_names_to_labels.items():
                print(f"{var}: {label}")
                # Check if PersonID is mentioned in any label
                if label and ('person' in str(label).lower() or 'id' in str(label).lower() or '编号' in str(label)):
                    print(f"  *** POTENTIAL MATCH FOR PERSONID ***")
        else:
            print("No variable labels found")
        
        print("\n" + "=" * 80)
        print("SEARCHING FOR PERSONID-RELATED VARIABLES")
        print("=" * 80)
        # Search for variables that might contain PersonID
        person_related = []
        id_related = []
        number_related = []
        
        for col in df.columns:
            col_lower = col.lower()
            if 'person' in col_lower:
                person_related.append(col)
            if 'id' in col_lower:
                id_related.append(col)
            if any(term in col_lower for term in ['num', 'no', 'code', 'key']):
                number_related.append(col)
        
        if person_related:
            print(f"Variables containing 'person': {person_related}")
        if id_related:
            print(f"Variables containing 'id': {id_related}")
        if number_related:
            print(f"Variables with number/code terms: {number_related}")
        
        # Also check variable labels for Chinese terms
        if meta.column_names_to_labels:
            chinese_matches = []
            for var, label in meta.column_names_to_labels.items():
                if label and any(term in str(label) for term in ['编号', '个人', '官员', 'ID', 'id']):
                    chinese_matches.append((var, label))
            
            if chinese_matches:
                print("\nVariables with Chinese terms for ID/person/officer:")
                for var, label in chinese_matches:
                    print(f"  {var}: {label}")
        
        print("\n" + "=" * 80)
        print("VALUE LABELS")
        print("=" * 80)
        if meta.value_labels:
            print(f"Number of variables with value labels: {len(meta.value_labels)}")
            # Show first few value labels
            for i, (var, labels) in enumerate(meta.value_labels.items()):
                if i < 5:  # Show first 5 variables with value labels
                    print(f"\n{var}:")
                    for value, label in list(labels.items())[:5]:  # Show first 5 values
                        print(f"  {value}: {label}")
                    if len(labels) > 5:
                        print(f"  ... ({len(labels) - 5} more values)")
        else:
            print("No value labels found")
        
        print("\n" + "=" * 80)
        print("FIRST FEW ROWS OF DATA (to check for any ID-like columns)")
        print("=" * 80)
        # Look for columns that might contain IDs (numeric or alphanumeric patterns)
        potential_id_cols = []
        for col in df.columns:
            if df[col].dtype in ['int64', 'float64', 'object']:
                # Check if column has unique or mostly unique values (characteristic of IDs)
                unique_ratio = len(df[col].dropna().unique()) / len(df[col].dropna())
                if unique_ratio > 0.8:  # More than 80% unique values
                    potential_id_cols.append((col, unique_ratio))
        
        if potential_id_cols:
            print("\nColumns with high uniqueness (potential ID columns):")
            for col, ratio in sorted(potential_id_cols, key=lambda x: x[1], reverse=True)[:10]:
                print(f"  {col}: {ratio:.2%} unique values")
                # Show sample values
                sample_values = df[col].dropna().head(3).tolist()
                print(f"    Sample values: {sample_values}")
        
        print("\n" + "=" * 80)
        print("ADDITIONAL METADATA")
        print("=" * 80)
        # Check for any other metadata attributes
        metadata_attrs = [attr for attr in dir(meta) if not attr.startswith('_')]
        for attr in metadata_attrs:
            if attr not in ['column_names_to_labels', 'value_labels', 'file_label', 
                           'file_encoding', 'readstat_variable_version']:
                value = getattr(meta, attr, None)
                if value and value != {} and value != []:
                    print(f"{attr}: {value}")
        
    except Exception as e:
        print(f"Error reading Stata file: {e}")
        return
    
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print("Script completed. Check the output above for any PersonID-related fields.")

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
        "Select a .dta file to explore:",
        choices=file_choices
    ).ask()
    
    if not selected:
        return None
    
    return os.path.join(dta_dir, selected)

if __name__ == "__main__":
    stata_file = select_stata_file()
    if stata_file:
        explore_stata_file(stata_file)
    else:
        print("No file selected. Exiting.")