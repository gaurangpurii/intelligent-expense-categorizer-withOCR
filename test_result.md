#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Smart Expense Categorizer with auth (email/password), per-user expense persistence,
  and improved OCR accuracy on merchant + amount detection.

backend:
  - task: "Auth — signup, login, logout, me"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implemented JWT (jose) + bcryptjs flow with httpOnly cookie 'sec_session'. Endpoints: POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me. Validates email/password, hashes password, prevents duplicate signup (409)."
      - working: true
        agent: "testing"
        comment: "✅ ALL 20 AUTH TESTS PASSED. Verified: (1) Signup with valid data returns 200 + user object with UUID id + sec_session cookie; (2) Duplicate signup returns 409 with error; (3) Short password (<6 chars) returns 400; (4) Invalid email returns 400; (5) GET /auth/me without cookie returns {user: null}; (6) GET /auth/me with cookie returns user object; (7) Login with valid creds returns 200 + cookie; (8) Login with wrong password returns 401; (9) Logout returns 200 and clears cookie; (10) After logout, /auth/me returns {user: null}. HttpOnly cookie 'sec_session' properly set with Path=/, SameSite=Lax, Secure=true."
  - task: "Expenses CRUD scoped to user"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoints: GET /api/expenses, POST /api/expenses (single), POST /api/expenses/bulk (import), PUT /api/expenses/:id, DELETE /api/expenses/:id, DELETE /api/expenses (clear all). All return 401 without valid session cookie. Each operation scoped by userId from JWT."
      - working: true
        agent: "testing"
        comment: "✅ ALL 27 EXPENSE TESTS PASSED. Verified: (1) All expense endpoints return 401 without authentication; (2) POST single expense returns 200 with expense object containing UUID id (no _id field exposed); (3) GET /api/expenses returns expenses array scoped to authenticated user; (4) PUT /api/expenses/:id successfully updates expense; (5) DELETE /api/expenses/:id removes expense; (6) POST /api/expenses/bulk with 3 items returns {inserted: 3} and all visible in GET; (7) DELETE /api/expenses clears all user expenses; (8) Multi-user isolation verified - User A and User B have completely separate expense lists; (9) After logout, GET /api/expenses returns 401. All IDs are UUID strings, not MongoDB ObjectIds."

frontend:
  - task: "Auth screen + dashboard gate"
    implemented: true
    working: "NA"
    file: "/app/app/page.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Login/Signup tabs, bootstraps /api/auth/me, gates Dashboard. Shows import prompt if legacy localStorage data exists. NOT testing frontend automatically per protocol."
  - task: "Improved OCR pipeline (preprocess + parser)"
    implemented: true
    working: "NA"
    file: "/app/lib/utils/categorize.js, /app/app/page.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Image preprocessing (resize, grayscale, contrast, binarize) before Tesseract. Tesseract PSM 6 + preserve_interword_spaces. Parser improved with labeled total weighting, negative-label filtering, smarter merchant scoring."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Auth — signup, login, logout, me"
    - "Expenses CRUD scoped to user"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Please test the new backend endpoints. Cookies are httpOnly so use a shared session cookie jar between requests.
      Scenarios:
        1. Signup new user with random email — expect 200 + Set-Cookie sec_session.
        2. Signup again same email — expect 409.
        3. /api/auth/me before login — {"user": null}.
        4. Login with valid creds — 200 + cookie; me returns user.
        5. Login with wrong password — 401.
        6. Create 2 users; ensure expenses are isolated per user.
        7. Expense CRUD as user A: POST expense, GET list (has it), PUT update merchant, DELETE expense, GET list (empty).
        8. POST /api/expenses/bulk with 3 items returns inserted=3 and visible in GET.
        9. Without cookie, all /api/expenses endpoints return 401.
        10. Logout clears cookie; subsequent GET /api/expenses returns 401.
      Use MONGO_URL/DB_NAME from /app/.env. Base URL: http://localhost:3000 (or external NEXT_PUBLIC_BASE_URL).
  - agent: "testing"
    message: |
      ✅ BACKEND TESTING COMPLETE - ALL TESTS PASSED (47/47)
      
      Executed comprehensive backend tests using /app/backend_test.py against https://expense-dash-pro-1.preview.emergentagent.com/api
      
      AUTH ENDPOINTS (20/20 passed):
      - Signup validation (email format, password length >=6, duplicate prevention with 409)
      - Login with valid/invalid credentials (401 on wrong password)
      - Logout clears httpOnly cookie
      - /auth/me returns user object with cookie, null without
      - HttpOnly cookie 'sec_session' properly configured (Path=/, SameSite=Lax, Secure=true)
      - All user IDs are UUID strings (not ObjectIds)
      
      EXPENSE ENDPOINTS (27/27 passed):
      - All endpoints return 401 without authentication ✅
      - POST single expense returns UUID id (no _id field exposed) ✅
      - GET expenses scoped to authenticated user ✅
      - PUT expense updates successfully ✅
      - DELETE single expense works ✅
      - POST /api/expenses/bulk with 3 items returns {inserted: 3} ✅
      - DELETE /api/expenses clears all user expenses ✅
      - Multi-user isolation verified (User A and User B have separate data) ✅
      - After logout, expense endpoints return 401 ✅
      
      NO CRITICAL ISSUES FOUND. Backend is production-ready.
