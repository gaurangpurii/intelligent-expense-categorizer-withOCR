#!/usr/bin/env python3
"""
Backend API tests for Smart Expense Categorizer
Tests auth endpoints and expense CRUD with multi-user isolation
"""
import requests
import uuid 
import json
from datetime import datetime

# Base URL from .env
BASE_URL = "https://expense-dash-pro-1.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

def generate_test_email():
    """Generate unique email for testing"""
    return f"test_{uuid.uuid4().hex[:8]}@example.com"

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")

class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.tests = []
    
    def test(self, name, condition, details=""):
        """Record test result"""
        if condition:
            self.passed += 1
            print_test(name, True, details)
        else:
            self.failed += 1
            print_test(name, False, details)
        self.tests.append((name, condition, details))
        return condition
    
    def summary(self):
        """Print test summary"""
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY: {self.passed}/{total} passed")
        if self.failed > 0:
            print(f"FAILED TESTS:")
            for name, passed, details in self.tests:
                if not passed:
                    print(f"  - {name}: {details}")
        print(f"{'='*60}\n")
        return self.failed == 0

def test_auth_endpoints():
    """Test authentication endpoints"""
    print("\n" + "="*60)
    print("TESTING AUTH ENDPOINTS")
    print("="*60 + "\n")
    
    runner = TestRunner()
    session = requests.Session()
    
    # Test 1: Signup with valid data
    print("Test 1: Signup with new user")
    email = generate_test_email()
    password = "password123"
    name = "Test User"
    
    resp = session.post(f"{API_BASE}/auth/signup", json={
        "email": email,
        "password": password,
        "name": name
    })
    
    runner.test(
        "Signup returns 200",
        resp.status_code == 200,
        f"Got {resp.status_code}, body: {resp.text[:200]}"
    )
    
    if resp.status_code == 200:
        data = resp.json()
        runner.test(
            "Signup returns user object",
            "user" in data and data["user"] is not None,
            f"Response: {data}"
        )
        
        if "user" in data and data["user"]:
            user = data["user"]
            runner.test("User has id field", "id" in user, f"User: {user}")
            runner.test("User has email field", "email" in user and user["email"] == email.lower(), f"User: {user}")
            runner.test("User has name field", "name" in user, f"User: {user}")
            runner.test("User id is UUID string", isinstance(user.get("id"), str) and len(user["id"]) > 20, f"ID: {user.get('id')}")
    
    runner.test(
        "Signup sets sec_session cookie",
        "sec_session" in session.cookies,
        f"Cookies: {list(session.cookies.keys())}"
    )
    
    # Test 2: GET /api/auth/me with cookie
    print("\nTest 2: GET /api/auth/me with valid session")
    resp = session.get(f"{API_BASE}/auth/me")
    runner.test(
        "/auth/me returns 200",
        resp.status_code == 200,
        f"Got {resp.status_code}"
    )
    
    if resp.status_code == 200:
        data = resp.json()
        runner.test(
            "/auth/me returns user",
            "user" in data and data["user"] is not None,
            f"Response: {data}"
        )
    
    # Test 3: Signup with same email (should fail with 409)
    print("\nTest 3: Signup with duplicate email")
    resp2 = requests.post(f"{API_BASE}/auth/signup", json={
        "email": email,
        "password": "different123",
        "name": "Another User"
    })
    
    runner.test(
        "Duplicate signup returns 409",
        resp2.status_code == 409,
        f"Got {resp2.status_code}, body: {resp2.text[:200]}"
    )
    
    runner.test(
        "Duplicate signup has error message",
        "error" in resp2.json() if resp2.status_code == 409 else False,
        f"Response: {resp2.json() if resp2.status_code == 409 else 'N/A'}"
    )
    
    # Test 4: Signup with short password
    print("\nTest 4: Signup with password < 6 chars")
    resp3 = requests.post(f"{API_BASE}/auth/signup", json={
        "email": generate_test_email(),
        "password": "12345",
        "name": "Short Pass"
    })
    
    runner.test(
        "Short password returns 400",
        resp3.status_code == 400,
        f"Got {resp3.status_code}, body: {resp3.text[:200]}"
    )
    
    # Test 5: Signup with invalid email
    print("\nTest 5: Signup with invalid email")
    resp4 = requests.post(f"{API_BASE}/auth/signup", json={
        "email": "not-an-email",
        "password": "password123",
        "name": "Bad Email"
    })
    
    runner.test(
        "Invalid email returns 400",
        resp4.status_code == 400,
        f"Got {resp4.status_code}, body: {resp4.text[:200]}"
    )
    
    # Test 6: GET /api/auth/me without cookie
    print("\nTest 6: GET /api/auth/me without session")
    session_no_auth = requests.Session()
    resp5 = session_no_auth.get(f"{API_BASE}/auth/me")
    
    runner.test(
        "/auth/me without cookie returns 200",
        resp5.status_code == 200,
        f"Got {resp5.status_code}"
    )
    
    if resp5.status_code == 200:
        data = resp5.json()
        runner.test(
            "/auth/me without cookie returns user: null",
            "user" in data and data["user"] is None,
            f"Response: {data}"
        )
    
    # Test 7: Login with valid credentials
    print("\nTest 7: Login with valid credentials")
    session_login = requests.Session()
    resp6 = session_login.post(f"{API_BASE}/auth/login", json={
        "email": email,
        "password": password
    })
    
    runner.test(
        "Login returns 200",
        resp6.status_code == 200,
        f"Got {resp6.status_code}, body: {resp6.text[:200]}"
    )
    
    runner.test(
        "Login sets sec_session cookie",
        "sec_session" in session_login.cookies,
        f"Cookies: {list(session_login.cookies.keys())}"
    )
    
    # Test 8: Login with wrong password
    print("\nTest 8: Login with wrong password")
    resp7 = requests.post(f"{API_BASE}/auth/login", json={
        "email": email,
        "password": "wrongpassword"
    })
    
    runner.test(
        "Wrong password returns 401",
        resp7.status_code == 401,
        f"Got {resp7.status_code}, body: {resp7.text[:200]}"
    )
    
    # Test 9: Logout
    print("\nTest 9: Logout")
    resp8 = session.post(f"{API_BASE}/auth/logout")
    
    runner.test(
        "Logout returns 200",
        resp8.status_code == 200,
        f"Got {resp8.status_code}"
    )
    
    # Test 10: After logout, /api/auth/me should return null
    print("\nTest 10: GET /api/auth/me after logout")
    resp9 = session.get(f"{API_BASE}/auth/me")
    
    if resp9.status_code == 200:
        data = resp9.json()
        runner.test(
            "/auth/me after logout returns user: null",
            "user" in data and data["user"] is None,
            f"Response: {data}"
        )
    else:
        runner.test(
            "/auth/me after logout returns user: null",
            False,
            f"Got {resp9.status_code}, expected 200"
        )
    
    return runner.summary()

def test_expense_endpoints():
    """Test expense CRUD endpoints"""
    print("\n" + "="*60)
    print("TESTING EXPENSE ENDPOINTS")
    print("="*60 + "\n")
    
    runner = TestRunner()
    
    # Create user A
    print("Setup: Creating User A")
    session_a = requests.Session()
    email_a = generate_test_email()
    resp = session_a.post(f"{API_BASE}/auth/signup", json={
        "email": email_a,
        "password": "password123",
        "name": "User A"
    })
    
    if resp.status_code != 200:
        print(f"❌ Failed to create User A: {resp.status_code} - {resp.text}")
        return False
    
    user_a_id = resp.json()["user"]["id"]
    print(f"✅ User A created: {email_a} (ID: {user_a_id})")
    
    # Test 1: GET /api/expenses without cookie
    print("\nTest 1: GET /api/expenses without authentication")
    session_no_auth = requests.Session()
    resp1 = session_no_auth.get(f"{API_BASE}/expenses")
    
    runner.test(
        "GET /api/expenses without cookie returns 401",
        resp1.status_code == 401,
        f"Got {resp1.status_code}, body: {resp1.text[:200]}"
    )
    
    # Test 2: POST /api/expenses without cookie
    print("\nTest 2: POST /api/expenses without authentication")
    resp2 = session_no_auth.post(f"{API_BASE}/expenses", json={
        "merchant": "Test Store",
        "amount": 50.00,
        "date": "2024-01-15",
        "category": "Shopping",
        "confidence": 0.95
    })
    
    runner.test(
        "POST /api/expenses without cookie returns 401",
        resp2.status_code == 401,
        f"Got {resp2.status_code}"
    )
    
    # Test 3: POST single expense as User A
    print("\nTest 3: POST single expense as User A")
    expense_data = {
        "merchant": "Coffee Shop",
        "amount": 5.50,
        "date": "2024-01-15",
        "category": "Food",
        "confidence": 0.90
    }
    
    resp3 = session_a.post(f"{API_BASE}/expenses", json=expense_data)
    
    runner.test(
        "POST expense returns 200",
        resp3.status_code == 200,
        f"Got {resp3.status_code}, body: {resp3.text[:200]}"
    )
    
    expense_id = None
    if resp3.status_code == 200:
        data = resp3.json()
        runner.test(
            "POST expense returns expense object",
            "expense" in data,
            f"Response: {data}"
        )
        
        if "expense" in data:
            expense = data["expense"]
            expense_id = expense.get("id")
            runner.test("Expense has id field", "id" in expense, f"Expense: {expense}")
            runner.test("Expense id is UUID string", isinstance(expense_id, str) and len(expense_id) > 20, f"ID: {expense_id}")
            runner.test("Expense has merchant", expense.get("merchant") == "Coffee Shop", f"Merchant: {expense.get('merchant')}")
            runner.test("Expense has amount", expense.get("amount") == 5.50, f"Amount: {expense.get('amount')}")
            runner.test("No _id field exposed", "_id" not in expense, f"Expense keys: {list(expense.keys())}")
    
    # Test 4: GET /api/expenses as User A
    print("\nTest 4: GET /api/expenses as User A")
    resp4 = session_a.get(f"{API_BASE}/expenses")
    
    runner.test(
        "GET expenses returns 200",
        resp4.status_code == 200,
        f"Got {resp4.status_code}"
    )
    
    if resp4.status_code == 200:
        data = resp4.json()
        runner.test(
            "GET expenses returns expenses array",
            "expenses" in data and isinstance(data["expenses"], list),
            f"Response keys: {list(data.keys())}"
        )
        
        if "expenses" in data:
            expenses = data["expenses"]
            runner.test(
                "Expenses list contains the posted expense",
                len(expenses) >= 1,
                f"Found {len(expenses)} expenses"
            )
            
            if len(expenses) >= 1:
                found = any(e.get("merchant") == "Coffee Shop" for e in expenses)
                runner.test(
                    "Posted expense is in the list",
                    found,
                    f"Merchants: {[e.get('merchant') for e in expenses]}"
                )
    
    # Test 5: PUT /api/expenses/:id
    if expense_id:
        print(f"\nTest 5: PUT /api/expenses/{expense_id}")
        resp5 = session_a.put(f"{API_BASE}/expenses/{expense_id}", json={
            "merchant": "Updated Coffee Shop",
            "amount": 6.00,
            "date": "2024-01-15",
            "category": "Food",
            "confidence": 0.95
        })
        
        runner.test(
            "PUT expense returns 200",
            resp5.status_code == 200,
            f"Got {resp5.status_code}, body: {resp5.text[:200]}"
        )
        
        # Verify update
        resp5b = session_a.get(f"{API_BASE}/expenses")
        if resp5b.status_code == 200:
            expenses = resp5b.json().get("expenses", [])
            updated = next((e for e in expenses if e.get("id") == expense_id), None)
            runner.test(
                "Expense was updated",
                updated and updated.get("merchant") == "Updated Coffee Shop",
                f"Updated merchant: {updated.get('merchant') if updated else 'Not found'}"
            )
    
    # Test 6: POST /api/expenses/bulk
    print("\nTest 6: POST /api/expenses/bulk with 3 items")
    bulk_expenses = [
        {"merchant": "Store 1", "amount": 10.00, "date": "2024-01-16", "category": "Shopping", "confidence": 0.85},
        {"merchant": "Store 2", "amount": 20.00, "date": "2024-01-17", "category": "Shopping", "confidence": 0.90},
        {"merchant": "Store 3", "amount": 30.00, "date": "2024-01-18", "category": "Shopping", "confidence": 0.95}
    ]
    
    resp6 = session_a.post(f"{API_BASE}/expenses/bulk", json={"expenses": bulk_expenses})
    
    runner.test(
        "POST bulk returns 200",
        resp6.status_code == 200,
        f"Got {resp6.status_code}, body: {resp6.text[:200]}"
    )
    
    if resp6.status_code == 200:
        data = resp6.json()
        runner.test(
            "Bulk insert returns inserted count",
            "inserted" in data and data["inserted"] == 3,
            f"Response: {data}"
        )
    
    # Verify bulk insert
    resp6b = session_a.get(f"{API_BASE}/expenses")
    if resp6b.status_code == 200:
        expenses = resp6b.json().get("expenses", [])
        runner.test(
            "GET expenses shows all bulk items",
            len(expenses) >= 4,  # 1 original + 3 bulk
            f"Total expenses: {len(expenses)}"
        )
    
    # Test 7: DELETE /api/expenses/:id
    if expense_id:
        print(f"\nTest 7: DELETE /api/expenses/{expense_id}")
        resp7 = session_a.delete(f"{API_BASE}/expenses/{expense_id}")
        
        runner.test(
            "DELETE expense returns 200",
            resp7.status_code == 200,
            f"Got {resp7.status_code}"
        )
        
        # Verify deletion
        resp7b = session_a.get(f"{API_BASE}/expenses")
        if resp7b.status_code == 200:
            expenses = resp7b.json().get("expenses", [])
            deleted = not any(e.get("id") == expense_id for e in expenses)
            runner.test(
                "Deleted expense is not in list",
                deleted,
                f"Expense IDs: {[e.get('id') for e in expenses]}"
            )
    
    # Test 8: Multi-user isolation
    print("\nTest 8: Multi-user isolation")
    print("Setup: Creating User B")
    session_b = requests.Session()
    email_b = generate_test_email()
    resp8 = session_b.post(f"{API_BASE}/auth/signup", json={
        "email": email_b,
        "password": "password123",
        "name": "User B"
    })
    
    if resp8.status_code != 200:
        print(f"❌ Failed to create User B: {resp8.status_code}")
        runner.test("Create User B", False, f"Status: {resp8.status_code}")
    else:
        user_b_id = resp8.json()["user"]["id"]
        print(f"✅ User B created: {email_b} (ID: {user_b_id})")
        
        # User B should not see User A's expenses
        resp8b = session_b.get(f"{API_BASE}/expenses")
        
        runner.test(
            "User B GET expenses returns 200",
            resp8b.status_code == 200,
            f"Got {resp8b.status_code}"
        )
        
        if resp8b.status_code == 200:
            data = resp8b.json()
            expenses_b = data.get("expenses", [])
            runner.test(
                "User B has no expenses initially",
                len(expenses_b) == 0,
                f"User B has {len(expenses_b)} expenses (should be 0)"
            )
            
            # Verify User A still has their expenses
            resp8c = session_a.get(f"{API_BASE}/expenses")
            if resp8c.status_code == 200:
                expenses_a = resp8c.json().get("expenses", [])
                runner.test(
                    "User A still has their expenses",
                    len(expenses_a) >= 3,  # 3 bulk items (1 was deleted)
                    f"User A has {len(expenses_a)} expenses"
                )
    
    # Test 9: DELETE /api/expenses (clear all)
    print("\nTest 9: DELETE /api/expenses (clear all for User A)")
    resp9 = session_a.delete(f"{API_BASE}/expenses")
    
    runner.test(
        "DELETE all expenses returns 200",
        resp9.status_code == 200,
        f"Got {resp9.status_code}"
    )
    
    if resp9.status_code == 200:
        data = resp9.json()
        runner.test(
            "DELETE all returns deleted count",
            "deleted" in data,
            f"Response: {data}"
        )
    
    # Verify all deleted
    resp9b = session_a.get(f"{API_BASE}/expenses")
    if resp9b.status_code == 200:
        expenses = resp9b.json().get("expenses", [])
        runner.test(
            "User A has no expenses after clear",
            len(expenses) == 0,
            f"User A has {len(expenses)} expenses (should be 0)"
        )
    
    # Test 10: After logout, expenses endpoint returns 401
    print("\nTest 10: Expenses endpoint after logout")
    session_a.post(f"{API_BASE}/auth/logout")
    resp10 = session_a.get(f"{API_BASE}/expenses")
    
    runner.test(
        "GET expenses after logout returns 401",
        resp10.status_code == 401,
        f"Got {resp10.status_code}"
    )
    
    return runner.summary()

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("SMART EXPENSE CATEGORIZER - BACKEND API TESTS")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"API Base: {API_BASE}")
    print("="*60)
    
    try:
        # Test auth endpoints
        auth_passed = test_auth_endpoints()
        
        # Test expense endpoints
        expense_passed = test_expense_endpoints()
        
        # Final summary
        print("\n" + "="*60)
        print("FINAL RESULTS")
        print("="*60)
        print(f"Auth Tests: {'✅ PASSED' if auth_passed else '❌ FAILED'}")
        print(f"Expense Tests: {'✅ PASSED' if expense_passed else '❌ FAILED'}")
        print("="*60 + "\n")
        
        if auth_passed and expense_passed:
            print("🎉 ALL TESTS PASSED!")
            return 0
        else:
            print("⚠️  SOME TESTS FAILED")
            return 1
            
    except Exception as e:
        print(f"\n❌ TEST EXECUTION ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
