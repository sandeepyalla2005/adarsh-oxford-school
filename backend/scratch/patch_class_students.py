import os

file_path = r"d:\school-fee-mangament system (3)\adarsh-oxford\frontend\src\pages\ClassStudents.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Normalize newlines for search and replace
target = """                if (error) {
                    if (error.code === '23505') {
                        throw new Error(`Admission Number "${formData.admission_number}" already exists in the selected class.`);
                    }
                    if (error.code === '22P02') {
                        throw new Error('Invalid data format. Please check numeric fields like fees.');
                    }
                    throw error;
                }

                if (data) {
                    // Log ADD action after successful insertion
                    await logStudentAction({
                        studentId: (data as any).id,"""

# Make sure we check both CRLF and LF
target_crlf = target.replace("\n", "\r\n")
target_lf = target.replace("\r\n", "\n")

replacement = """                if (data.data) {
                    // Log ADD action after successful insertion
                    await logStudentAction({
                        studentId: data.data.id,"""

replacement_crlf = replacement.replace("\n", "\r\n")

if target_crlf in content:
    content = content.replace(target_crlf, replacement_crlf)
    print("Found and replaced with CRLF line endings!")
elif target_lf in content:
    content = content.replace(target_lf, replacement)
    print("Found and replaced with LF line endings!")
else:
    print("Could not find the target content in ClassStudents.tsx")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
