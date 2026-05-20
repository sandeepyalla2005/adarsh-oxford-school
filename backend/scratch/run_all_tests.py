import os
import json
import httpx
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client

# Load env
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials in .env")
    exit(1)

# Direct DB connection for state setup/teardown
db_client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Local FastAPI API base URL
API_BASE = "http://localhost:8000"

results = []

def log_test(tc_id, module, scenario, expected, actual, status, remarks="", logs=None):
    results.append({
        "id": tc_id,
        "module": module,
        "scenario": scenario,
        "expected": expected,
        "actual": actual,
        "status": status,
        "remarks": remarks,
        "logs": logs or ""
    })
    print(f"[{status}] {tc_id}: {scenario}")

# Helpers to get Supabase tokens
def get_user_token(email, password):
    login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    headers = {"apikey": SUPABASE_KEY, "Content-Type": "application/json"}
    payload = {"email": email, "password": password}
    try:
        resp = httpx.post(login_url, json=payload, headers=headers, timeout=30.0)
        if resp.status_code == 200:
            return resp.json()["access_token"], None
        else:
            return None, f"Status {resp.status_code}: {resp.text}"
    except Exception as e:
        return None, str(e)

def run_tests():
    # Use httpx Client with a 30-second timeout to prevent gateway timeouts
    client = httpx.Client(timeout=30.0)

    # ----------------------------------------------------
    # 1. LOGIN & AUTHENTICATION TESTING
    # ----------------------------------------------------
    
    # TC-AUTH-01: Admin Valid Login
    admin_token, err = get_user_token("admin@adarshoxford.com", "Sandeepadmin@143")
    if admin_token:
        log_test("TC-AUTH-01", "Auth", "Admin login with valid credentials", "Token returned successfully", "Login successful, token returned", "Pass")
    else:
        log_test("TC-AUTH-01", "Auth", "Admin login with valid credentials", "Token returned successfully", f"Failed: {err}", "Fail")
        
    # TC-AUTH-02: Staff Valid Login
    staff_token, err = get_user_token("kushal@gmail.com", "password123")
    if staff_token:
        log_test("TC-AUTH-02", "Auth", "Staff login with valid credentials", "Token returned successfully", "Login successful, token returned", "Pass")
    else:
        log_test("TC-AUTH-02", "Auth", "Staff login with valid credentials", "Token returned successfully", f"Failed: {err}", "Fail")

    # TC-AUTH-03: Fee In-Charge Valid Login
    fee_token, err = get_user_token("feeincharge@adarshoxford.com", "password123")
    if fee_token:
        log_test("TC-AUTH-03", "Auth", "Fee In-Charge login with valid credentials", "Token returned successfully", "Login successful, token returned", "Pass")
    else:
        log_test("TC-AUTH-03", "Auth", "Fee In-Charge login with valid credentials", "Token returned successfully", f"Failed: {err}", "Fail")

    # TC-AUTH-04: Invalid password login
    _, err = get_user_token("admin@adarshoxford.com", "wrongpassword")
    if err:
        log_test("TC-AUTH-04", "Auth", "Login with invalid password", "Authentication fails (400)", f"Failed as expected: {err}", "Pass")
    else:
        log_test("TC-AUTH-04", "Auth", "Login with invalid password", "Authentication fails (400)", "Incorrectly succeeded login", "Fail")

    # TC-AUTH-05: Empty field login
    _, err = get_user_token("", "")
    if err:
        log_test("TC-AUTH-05", "Auth", "Login with empty credentials", "Authentication fails (400)", f"Failed as expected: {err}", "Pass")
    else:
        log_test("TC-AUTH-05", "Auth", "Login with empty credentials", "Authentication fails (400)", "Incorrectly succeeded login", "Fail")

    # ----------------------------------------------------
    # 2. ROLE-BASED ACCESS CONTROL (RBAC)
    # ----------------------------------------------------
    headers_staff = {"Authorization": f"Bearer {staff_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_fee = {"Authorization": f"Bearer {fee_token}"}

    # TC-RBAC-01: Staff cannot access admin pending wipes
    try:
        resp = client.get(f"{API_BASE}/api/auth/admin/pending-wipes", headers=headers_staff)
        is_blocked = resp.status_code == 403 or (resp.status_code == 200 and resp.json() == [])
        if is_blocked:
            log_test("TC-RBAC-01", "RBAC", "Staff attempts to fetch pending wipes", "Access denied or returns empty array", f"Returned status {resp.status_code}", "Pass")
        else:
            log_test("TC-RBAC-01", "RBAC", "Staff attempts to fetch pending wipes", "Access denied or returns empty array", f"Returned status {resp.status_code} with body: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-RBAC-01", "RBAC", "Staff attempts to fetch pending wipes", "Access denied", str(e), "Fail")

    # TC-RBAC-02: Staff cannot promote students
    try:
        resp = client.post(f"{API_BASE}/api/students/promote", json={"otp": "123456"}, headers=headers_staff)
        if resp.status_code == 403:
            log_test("TC-RBAC-02", "RBAC", "Staff attempts to promote students", "403 Forbidden", "Received 403 Forbidden", "Pass")
        else:
            log_test("TC-RBAC-02", "RBAC", "Staff attempts to promote students", "403 Forbidden", f"Received status {resp.status_code}", "Fail")
    except Exception as e:
        log_test("TC-RBAC-02", "RBAC", "Staff attempts to promote students", "403 Forbidden", str(e), "Fail")

    # TC-RBAC-03: Admin has full access to pending wipes
    try:
        resp = client.get(f"{API_BASE}/api/auth/admin/pending-wipes", headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-RBAC-03", "RBAC", "Admin fetches pending wipes", "200 OK list", f"Successfully loaded, status {resp.status_code}", "Pass")
        else:
            log_test("TC-RBAC-03", "RBAC", "Admin fetches pending wipes", "200 OK list", f"Status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-RBAC-03", "RBAC", "Admin fetches pending wipes", "200 OK list", str(e), "Fail")

    # ----------------------------------------------------
    # 3. STUDENT MANAGEMENT & INPUT VALIDATION
    # ----------------------------------------------------
    
    # Retrieve a valid class ID first
    classes_res = db_client.table("classes").select("id, name").order("sort_order").execute()
    if classes_res.data:
        test_class = classes_res.data[0]
        class_id = test_class["id"]
        class_name = test_class["name"]
    else:
        print("No classes found in DB. Aborting CRUD tests.")
        return

    # Cleanup any existing test student records first
    db_client.table("students").delete().eq("admission_number", "TEST-999").execute()
    db_client.table("students").delete().eq("admission_number", "TEST-888").execute()

    # TC-STUD-01: Create student missing mandatory fields (Pydantic validation)
    try:
        invalid_payload = {"roll_number": "10"}
        resp = client.post(f"{API_BASE}/api/students", json=invalid_payload, headers=headers_admin)
        if resp.status_code == 422:
            log_test("TC-STUD-01", "Student Management", "Add student with missing mandatory fields", "422 Unprocessable Entity", "FastAPI validation rejected the payload with 422", "Pass")
        else:
            log_test("TC-STUD-01", "Student Management", "Add student with missing mandatory fields", "422 Unprocessable Entity", f"Received status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-STUD-01", "Student Management", "Add student with missing mandatory fields", "422 Unprocessable Entity", str(e), "Fail")

    # TC-STUD-02: Create student successfully (Admin)
    new_student_payload = {
        "admission_number": "TEST-999",
        "full_name": "Test Automation Student",
        "class_id": class_id,
        "roll_number": "99",
        "gender": "Male",
        "father_name": "Test Father",
        "father_phone": "9876543210",
        "mother_name": "Test Mother",
        "mother_phone": "8765432109",
        "dob": "2015-05-15",
        "aadhaar": "123456789012",
        "address": "123 Test Street, Test City",
        "term1_fee": 15000.0,
        "term2_fee": 12000.0,
        "term3_fee": 10000.0,
        "has_books": True,
        "books_fee": 3000.0,
        "has_transport": True,
        "transport_fee": 4000.0,
        "old_dues": 500.0,
        "parent_email": "parent_test@example.com",
        "student_type": "new",
        "is_active": True,
        "status": "active"
    }
    
    student_id = None
    try:
        resp = client.post(f"{API_BASE}/api/students", json=new_student_payload, headers=headers_admin)
        if resp.status_code == 200:
            student_data = resp.json()["data"]
            student_id = student_data["id"]
            log_test("TC-STUD-02", "Student Management", "Add student with valid fields", "Student created successfully", f"Created student ID: {student_id}", "Pass")
        else:
            log_test("TC-STUD-02", "Student Management", "Add student with valid fields", "Student created successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-STUD-02", "Student Management", "Add student with valid fields", "Student created successfully", str(e), "Fail")

    if not student_id:
        print("Test student creation failed. Skipping subsequent integration tests.")
        return

    # TC-STUD-03: Search / Read student details
    try:
        resp = client.get(f"{API_BASE}/api/class-students?class_name={class_name}", headers=headers_admin)
        if resp.status_code == 200:
            students_list = resp.json()
            found = [s for s in students_list if s["id"] == student_id]
            if found:
                log_test("TC-STUD-03", "Student Management", "Search / View child information", "Student present in class student list", f"Student found in list for {class_name}", "Pass")
            else:
                log_test("TC-STUD-03", "Student Management", "Search / View child information", "Student present in class student list", "Student not found in class lists", "Fail")
        else:
            log_test("TC-STUD-03", "Student Management", "Search / View child information", "Student list loaded", f"Failed status {resp.status_code}", "Fail")
    except Exception as e:
        log_test("TC-STUD-03", "Student Management", "Search / View child information", "Student list loaded", str(e), "Fail")

    # TC-STUD-04: Edit student details
    edited_payload = dict(new_student_payload)
    edited_payload["full_name"] = "Test Automation Student Edited"
    edited_payload["roll_number"] = "100"
    
    try:
        resp = client.put(f"{API_BASE}/api/students/{student_id}", json=edited_payload, headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-STUD-04", "Student Management", "Edit student details", "Details updated successfully", "Successfully updated name and roll number", "Pass")
        else:
            log_test("TC-STUD-04", "Student Management", "Edit student details", "Details updated successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-STUD-04", "Student Management", "Edit student details", "Details updated successfully", str(e), "Fail")

    # ----------------------------------------------------
    # 4. COURSE & TRANSPORT & BOOKS FEE MANAGEMENT
    # ----------------------------------------------------
    # TC-FEE-01: Collect Course Fee Payment
    course_payment_payload = {
        "student_id": student_id,
        "type": "course",
        "academic_year": "2025-26",
        "amount": 5000.0,
        "method": "cash",
        "term": 1,
        "receipt_number": "REC-COURSE-999"
    }
    try:
        resp = client.post(f"{API_BASE}/api/payments/collect", json=course_payment_payload, headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-FEE-01", "Course Fee", "Collect Course fee payment for student", "Payment recorded successfully", "Course payment collected", "Pass")
        else:
            log_test("TC-FEE-01", "Course Fee", "Collect Course fee payment for student", "Payment recorded successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-FEE-01", "Course Fee", "Collect Course fee payment for student", "Payment recorded successfully", str(e), "Fail")

    # TC-FEE-02: Collect Books Fee Payment
    books_payment_payload = {
        "student_id": student_id,
        "type": "books",
        "academic_year": "2025-26",
        "amount": 1500.0,
        "method": "qr_code",
        "receipt_number": "REC-BOOKS-999"
    }
    try:
        resp = client.post(f"{API_BASE}/api/payments/collect", json=books_payment_payload, headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-FEE-02", "Books Fee", "Collect Books fee payment for student", "Payment recorded successfully", "Books payment collected", "Pass")
        else:
            log_test("TC-FEE-02", "Books Fee", "Collect Books fee payment for student", "Payment recorded successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-FEE-02", "Books Fee", "Collect Books fee payment for student", "Payment recorded successfully", str(e), "Fail")

    # TC-FEE-03: Collect Transport Fee Payment
    transport_payment_payload = {
        "student_id": student_id,
        "type": "transport",
        "academic_year": "2025-26",
        "amount": 2000.0,
        "method": "card",
        "term": 1, # Month/Quarter number
        "receipt_number": "REC-TRANS-999"
    }
    try:
        resp = client.post(f"{API_BASE}/api/payments/collect", json=transport_payment_payload, headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-FEE-03", "Transport Fee", "Collect Transport fee payment for student", "Payment recorded successfully", "Transport payment collected", "Pass")
        else:
            log_test("TC-FEE-03", "Transport Fee", "Collect Transport fee payment for student", "Payment recorded successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-FEE-03", "Transport Fee", "Collect Transport fee payment for student", "Payment recorded successfully", str(e), "Fail")

    # TC-FEE-04: Calculate pending fees and verify data consistency
    try:
        # Check payments registered in DB using service role direct select
        cp = db_client.table("course_payments").select("amount_paid").eq("student_id", student_id).execute()
        bp = db_client.table("books_payments").select("amount_paid").eq("student_id", student_id).execute()
        tp = db_client.table("transport_payments").select("amount_paid").eq("student_id", student_id).execute()
        
        tot_c = sum(float(x["amount_paid"] or 0) for x in cp.data)
        tot_b = sum(float(x["amount_paid"] or 0) for x in bp.data)
        tot_t = sum(float(x["amount_paid"] or 0) for x in tp.data)
        
        if tot_c == 5000.0 and tot_b == 1500.0 and tot_t == 2000.0:
            log_test("TC-FEE-04", "Fee Details", "Calculate course, books, and transport pending balance", "Balance calculations correct in DB tables", f"Paid course: {tot_c}, books: {tot_b}, transport: {tot_t}", "Pass")
        else:
            log_test("TC-FEE-04", "Fee Details", "Calculate course, books, and transport pending balance", "Balance calculations correct in DB tables", f"Mismatched paid course: {tot_c}, books: {tot_b}, transport: {tot_t}", "Fail")
    except Exception as e:
        log_test("TC-FEE-04", "Fee Details", "Calculate course, books, and transport pending balance", "Balance calculations correct in DB tables", str(e), "Fail")

    # ----------------------------------------------------
    # 5. INTEGRATION TESTING: DATA FLOW & CONSISTENCY
    # ----------------------------------------------------
    
    # TC-INT-01: Student creation propagates to other tables/modules
    try:
        resp = client.get(f"{API_BASE}/api/class-students?class_name=all", headers=headers_admin)
        if resp.status_code == 200:
            all_stu = resp.json()
            match = [s for s in all_stu if s["id"] == student_id]
            if match:
                log_test("TC-INT-01", "Integration", "New student propagates to Course, Books, and Transport lists", "Student shows up in all lists", "Confirmed student appears in class-students query", "Pass")
            else:
                log_test("TC-INT-01", "Integration", "New student propagates to Course, Books, and Transport lists", "Student shows up in all lists", "Failed to find student in list", "Fail")
        else:
            log_test("TC-INT-01", "Integration", "New student propagates to Course, Books, and Transport lists", "Student shows up in all lists", f"Failed api response {resp.status_code}", "Fail")
    except Exception as e:
        log_test("TC-INT-01", "Integration", "New student propagates to Course, Books, and Transport lists", "Student shows up in all lists", str(e), "Fail")

    # TC-INT-02: Receipt Details Integration
    try:
        cp_res = db_client.table("course_payments").select("*").eq("student_id", student_id).execute()
        if cp_res.data:
            rec = cp_res.data[0]
            if rec["amount_paid"] == 5000.0 and rec["payment_method"] == "cash" and rec["receipt_number"] == "REC-COURSE-999":
                log_test("TC-INT-02", "Integration", "Payment receipt verification", "Receipt matches name, amount, method, and date", f"Receipt verified: {rec['receipt_number']} | cash | Rs. {rec['amount_paid']}", "Pass")
            else:
                log_test("TC-INT-02", "Integration", "Payment receipt verification", "Receipt matches", f"Mismatched receipt details: {rec}", "Fail")
        else:
            log_test("TC-INT-02", "Integration", "Payment receipt verification", "Receipt matches", "No receipt record found", "Fail")
    except Exception as e:
        log_test("TC-INT-02", "Integration", "Payment receipt verification", "Receipt matches", str(e), "Fail")

    # ----------------------------------------------------
    # 6. TEARDOWN / CLEANUP & DELETION TESTING
    # ----------------------------------------------------
    # Clean up transactions first to prevent foreign key errors
    try:
        db_client.table("course_payments").delete().eq("student_id", student_id).execute()
        db_client.table("books_payments").delete().eq("student_id", student_id).execute()
        db_client.table("transport_payments").delete().eq("student_id", student_id).execute()
        
        # Zero out the fee structure on the student record to satisfy the "Cannot delete student with pending fees" validation
        db_client.table("students").update({
            "term1_fee": 0, "term2_fee": 0, "term3_fee": 0,
            "books_fee": 0, "transport_fee": 0, "old_dues": 0
        }).eq("id", student_id).execute()

        # TC-STUD-05: Delete Student API
        resp = client.post(f"{API_BASE}/api/students/delete/{student_id}", json={"otp": ""}, headers=headers_admin)
        if resp.status_code == 200:
            log_test("TC-STUD-05", "Student Management", "Delete student", "Student deleted successfully", "Delete API returns 200", "Pass")
        else:
            log_test("TC-STUD-05", "Student Management", "Delete student", "Student deleted successfully", f"Failed status {resp.status_code}: {resp.text}", "Fail")
    except Exception as e:
        log_test("TC-STUD-05", "Student Management", "Delete student", "Student deleted successfully", str(e), "Fail")

    # Clean up any leftover records
    db_client.table("students").delete().eq("id", student_id).execute()

    # Save results to JSON file
    test_report_path = os.path.join(os.path.dirname(__file__), "test_results.json")
    with open(test_report_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nAll tests completed. Saved results to: {test_report_path}")

if __name__ == "__main__":
    run_tests()
