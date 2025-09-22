#!/usr/bin/env python3
import subprocess
import sys
import os
import glob
import hashlib

def install_package(package):
    """Install a package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"Successfully installed {package}")
    except subprocess.CalledProcessError:
        print(f"Failed to install {package}")
        sys.exit(1)

def check_and_install_dependencies():
    """Check if required packages are installed, install if not"""
    required_packages = ['pandas', 'pyreadstat', 'openpyxl', 'questionary', 'opencc']
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"{package} is already installed")
        except ImportError:
            print(f"{package} not found, installing...")
            install_package(package)

def scan_dta_files(dta_dir="dta"):
    """Scan dta/ directory for .dta files"""
    if not os.path.exists(dta_dir):
        print(f"Directory {dta_dir}/ not found. Creating it...")
        os.makedirs(dta_dir, exist_ok=True)
        return []
    
    dta_files = glob.glob(os.path.join(dta_dir, "*.dta"))
    return dta_files

def ensure_output_dir(output_dir="output"):
    """Ensure output directory exists"""
    if not os.path.exists(output_dir):
        print(f"Creating {output_dir}/ directory...")
        os.makedirs(output_dir, exist_ok=True)

def generate_person_uid(row):
    """Generate PersonUID using scholar's method: 姓名 + 身份二 + 旗分 + 出身一"""
    # Get name fields
    surname = str(row.get('姓', '')).strip()
    given_name = str(row.get('名', '')).strip()
    xingming = surname + given_name
    
    # Get all identifying fields (excluding temporal fields like 年份季节)
    shenfen_er = str(row.get('身份二', '')).strip()
    qifen = str(row.get('旗分', '')).strip()
    chushen_yi = str(row.get('出身一', '')).strip()
    
    # Create composite key with person identifying fields only
    composite_key = f"{xingming}|{shenfen_er}|{qifen}|{chushen_yi}"
    
    # Generate hash
    person_hash = hashlib.md5(composite_key.encode('utf-8')).hexdigest()[:12]
    
    return person_hash

def convert_text_to_traditional(text):
    """Convert text to traditional Chinese using opencc"""
    try:
        import opencc
        converter = opencc.OpenCC('s2t')  # simplified to traditional
        return converter.convert(str(text))
    except ImportError:
        print(f"Warning: opencc module not available, using original text")
        return str(text)
    except Exception as e:
        print(f"Warning: opencc conversion failed ({e}), using original text")
        return str(text)

def convert_csv_string_to_traditional(csv_string):
    """Convert CSV string to traditional Chinese using opencc Python module"""
    import re
    
    try:
        # Try using opencc Python module to convert the entire CSV string
        import opencc
        converter = opencc.OpenCC('s2t')  # simplified to traditional
        converted_string = converter.convert(csv_string)
    except ImportError:
        print(f"Warning: opencc module not available, using original text")
        converted_string = csv_string
    except Exception as e:
        print(f"Warning: opencc conversion failed ({e}), using original text")
        converted_string = csv_string
    
    # Special replacement for 举人 -> 舉人 and 擧人 -> 舉人
    converted_string = re.sub(r'举人', '舉人', converted_string)
    converted_string = re.sub(r'擧人', '舉人', converted_string)
    
    return converted_string

def convert_stata_to_csv(stata_file_path, output_dir="output"):
    """Convert Stata .dta file to CSV with BOM and PersonUID"""
    import pandas as pd
    import pyreadstat
    
    if not os.path.exists(stata_file_path):
        print(f"Error: File {stata_file_path} not found")
        return False
    
    filename = os.path.basename(stata_file_path).replace('.dta', '.csv')
    output_csv_path = os.path.join(output_dir, filename)
    
    try:
        df, meta = pyreadstat.read_dta(stata_file_path)
        
        # First convert all content to traditional Chinese
        print("Converting simplified Chinese to traditional Chinese...")
        csv_string = df.to_csv(index=False)
        converted_csv_string = convert_csv_string_to_traditional(csv_string)
        
        # Read back as DataFrame with traditional Chinese content
        from io import StringIO
        df = pd.read_csv(StringIO(converted_csv_string))
        
        # Add PersonUID column using traditional Chinese content
        print("Generating PersonUID...")
        df['PersonUID'] = df.apply(generate_person_uid, axis=1)
        
        # Move PersonUID to first column
        cols = ['PersonUID'] + [col for col in df.columns if col != 'PersonUID']
        df = df[cols]
        
        # Convert to final CSV string
        print("Generating final CSV...")
        final_csv_string = df.to_csv(index=False)
        
        # Write to file with BOM
        with open(output_csv_path, 'w', encoding='utf-8-sig') as f:
            f.write(final_csv_string)
        print(f"Successfully converted to CSV with PersonUID: {output_csv_path}")
        return True
    except Exception as e:
        print(f"Error converting to CSV: {e}")
        return False

def convert_stata_to_excel(stata_file_path, output_dir="output"):
    """Convert Stata .dta file to Excel with PersonUID"""
    import pandas as pd
    import pyreadstat
    
    if not os.path.exists(stata_file_path):
        print(f"Error: File {stata_file_path} not found")
        return False
    
    filename = os.path.basename(stata_file_path).replace('.dta', '.xlsx')
    output_excel_path = os.path.join(output_dir, filename)
    
    try:
        df, meta = pyreadstat.read_dta(stata_file_path)
        
        # First convert all content to traditional Chinese
        print("Converting simplified Chinese to traditional Chinese...")
        csv_string = df.to_csv(index=False)
        converted_csv_string = convert_csv_string_to_traditional(csv_string)
        
        # Read back as DataFrame with traditional Chinese content
        from io import StringIO
        df = pd.read_csv(StringIO(converted_csv_string))
        
        # Add PersonUID column using traditional Chinese content
        print("Generating PersonUID...")
        df['PersonUID'] = df.apply(generate_person_uid, axis=1)
        
        # Move PersonUID to first column
        cols = ['PersonUID'] + [col for col in df.columns if col != 'PersonUID']
        df_converted = df[cols]
        
        df_converted.to_excel(output_excel_path, index=False, engine='openpyxl')
        print(f"Successfully converted to Excel with PersonUID: {output_excel_path}")
        return True
    except Exception as e:
        print(f"Error converting to Excel: {e}")
        return False

def main():
    print("Stata to CSV/Excel Converter")
    print("=" * 40)
    
    # Check and install dependencies
    print("Checking dependencies...")
    check_and_install_dependencies()
    
    # Import questionary after ensuring it's installed
    import questionary
    
    # Ensure output directory exists
    ensure_output_dir()
    
    # Scan for .dta files
    print("\nScanning dta/ directory for .dta files...")
    dta_files = scan_dta_files()
    
    if not dta_files:
        print("No .dta files found in dta/ directory.")
        print("Please place your .dta files in the dta/ directory and run again.")
        return
    
    # Display found files
    print(f"Found {len(dta_files)} .dta file(s):")
    for i, file in enumerate(dta_files, 1):
        print(f"  {i}. {os.path.basename(file)}")
    
    # Interactive file selection
    file_choices = [os.path.basename(file) for file in dta_files]
    file_choices.append("Select all files")
    
    selected_files = questionary.checkbox(
        "Select file(s) to convert:",
        choices=file_choices
    ).ask()
    
    if not selected_files:
        print("No files selected. Exiting.")
        return
    
    # Format selection
    format_choice = questionary.select(
        "Select output format:",
        choices=["CSV only", "Excel only", "Both CSV and Excel"]
    ).ask()
    
    if not format_choice:
        print("No format selected. Exiting.")
        return
    
    # Process files
    if "Select all files" in selected_files:
        files_to_convert = dta_files
    else:
        # Map selected basenames back to full paths
        files_to_convert = []
        for selected_basename in selected_files:
            for full_path in dta_files:
                if os.path.basename(full_path) == selected_basename:
                    files_to_convert.append(full_path)
                    break
    
    print(f"\nProcessing {len(files_to_convert)} file(s)...")
    
    success_count = 0
    for stata_file in files_to_convert:
        print(f"\nConverting: {os.path.basename(stata_file)}")
        
        file_success = False
        
        if format_choice in ["CSV only", "Both CSV and Excel"]:
            csv_success = convert_stata_to_csv(stata_file)
            file_success = file_success or csv_success
        
        if format_choice in ["Excel only", "Both CSV and Excel"]:
            excel_success = convert_stata_to_excel(stata_file)
            file_success = file_success or excel_success
        
        if file_success:
            success_count += 1
    
    print(f"\nConversion completed! {success_count}/{len(files_to_convert)} files converted successfully.")
    print("Output files saved to output/ directory.")

if __name__ == "__main__":
    main()