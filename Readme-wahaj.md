// IN SHORT
1. Google/GitHub Login
We fixed the OAuth setup confusion.
Google needs two different things:
Authorized JavaScript origins: frontend only, like http://localhost:5173
Authorized redirect URIs: backend callback, like http://localhost:5000/api/auth/google/callback
Your earlier issue happened because the callback URL was added in the wrong place or the client ID/redirect flow did not match.
I also made the backend use the env values properly:
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
JWT_SECRET
2. JWT Session Login
We added real token/session behavior.
When a user logs in:
Backend creates a JWT.
Frontend stores it.
App validates the session through /api/session.
If the user is deleted/banned, session validation fails and logs them out.
This makes login state safer and persistent.
3. Invite Member Email
We added automatic invite emails.
When an admin invites someone:
Backend saves/inserts that user.
Backend builds a join link.
Backend sends the email through Gmail SMTP using nodemailer.
Env variables used:
SMTP_USER
SMTP_PASS
SMTP_FROM
FRONTEND_URL
The important thing: Gmail does not accept normal password here. It needs a Gmail App Password.
4. Invited Members Persist
Before, invited users could appear temporarily and disappear after reload.
We fixed that by saving invited members into the database. Now when the page reloads, TeamDirectory fetches real users from /api/users.
5. Team Directory Admin Management
We added admin user controls.
Admins can:
Edit user name
Edit email
Edit role/position
Edit online/offline/away status
Make another user admin
Delete user
Ban email
Shadow ban for 7/30 days
Permanently ban
We first added a “Manage” button, then replaced it with the three-dot actions menu you requested.
6. Admin-Only Protection
We made those sensitive actions admin-only.
This is protected in two places:
Frontend only shows actions for admins.
Backend checks JWT and verifies role === 'Admin'.
So even if a non-admin manually calls the API, the backend blocks it.
7. Ban / Shadow Ban System
We added a real ban system.
Backend table: banned_emails
It stores:
email
user_id
reason
ban_type
expires_at
created_at
Behavior:
Permanent ban: email can never log in/signup.
Shadow ban: email cannot log in until expiry date.
Banned user is removed from active users.
Same email cannot be invited again.
Same email cannot login with Google/GitHub/local login.
Already logged-in banned user gets logged out in realtime.
8. Ban Login Popup
We added frontend popup messages for banned users.
Examples:
“You can’t log in until X because you are shadow banned.”
“You can’t log in because this email is permanently banned.”
This works for normal login and OAuth redirect errors.
9. Task Comments Fix
You had an issue where comments on assigned tasks were not updating in UI.
We fixed comment state/backend syncing so:
New comment appears immediately.
Comment count updates.
Comment persists after reload.
10. Comment Time Fix
Old comments were showing “Just now”.
We fixed timestamp handling so comments use their real saved timestamp and show the correct relative age.
11. Complete Task Option
We added ways to complete a task.
Now a task can be marked Done:
From task details status dropdown.
From the quick check button on the Kanban card.
It updates UI and syncs to backend.
12. Team Actions Dropdown UI Fix
The actions menu was overflowing/clipped inside the team table.
We changed the dropdown behavior/styling so it appears outside properly and stays clickable.
13. Actions Button Click Fix
The three-dot button was visible but not clickable for admin.
We fixed the layering/click handling so admins can open the menu properly.
14. Realtime Messaging
We added realtime message rendering with Socket.IO.
Now when someone sends a message:
Backend saves it.
Backend emits message:received.
Frontend receives it instantly.
Chat UI updates without refresh.
This works for:
Channels
Direct messages
15. Realtime Notifications
We added realtime notifications for messages.
When a message arrives:
Header notification list updates.
Toast can appear if user is not in chat.
Notification includes who sent it and where.
16. Member Tagging in Messages
We added @mention support.
In chat:
Type @
Member suggestions appear.
Pick a member.
Mention is inserted into message.
Mention renders highlighted.
17. Inbox Scroll Fix
Inbox page had unwanted page-level scroll.
Cause:
Chat used h-screen inside an app shell that already had a header.
Fix:
Chat now uses available panel height.
Page itself does not scroll.
Only message list/sidebars scroll internally when needed.
18. Real Members in Add Task Assignee
Add Task assignee dropdown used old hardcoded users from data.ts.
We changed it to fetch real members from /api/users.
Now when you add/invite/edit users, they appear in Add Task assignee list.
19. AI Task Generator
We added Gemini AI into Projects/Add Task.
In Add Task modal:
There is a sparkle AI icon.
There is an “AI Task Brief” field.
User writes something like: Fix the endpoint /api/data
AI generates:
Task title
Description
Acceptance criteria
Priority
Tags
Best assignee from real members
Backend route:
POST /api/ai/tasks/draft
Frontend helper:
generateTaskDraft(...)
Key used:
GEMINI_API_KEY in backend/.env
I kept the Gemini key on the backend so it is not exposed to the browser.
20. Gemini Model Fallback Fix
After adding AI, you got:
404 for /api/ai/tasks/draft
Then Gemini model errors
The 404 happened because the backend process was stale and needed restart.
Then Gemini said gemini-1.5-flash was unavailable. I changed backend to try multiple models automatically:
GEMINI_MODEL from env
gemini-2.5-flash
gemini-2.0-flash
gemini-flash-latest
gemini-1.5-flash
Also if one model is overloaded with 503 or rate limited with 429, backend tries the next one.
21. Env Documentation
We updated .env.example with needed variables, including:
JWT_SECRET
GEMINI_API_KEY
GEMINI_MODEL
OAuth keys
SMTP keys
frontend/backend URLs
Main Files We Worked On
Important files changed:
backend/server.js: users, bans, invites, messages, tasks, AI endpoint.
backend/config/passport.js: Google/GitHub login and ban checks.
backend/routes/auth.js: OAuth redirects/session token handling.
frontend/src/App.tsx: session validation, notifications, banned logout, layout.
frontend/src/api.ts: frontend API helpers.
frontend/src/components/TeamDirectory.tsx: invite/manage/admin actions.
frontend/src/components/TaskBoard.tsx: complete task, real assignees, AI task generator.
frontend/src/components/TaskDetailsModal.tsx: comments/status fixes.
frontend/src/components/Chat.tsx: realtime messaging, mentions, scroll behavior.
frontend/src/components/Header.tsx: notifications.
.env.example: documented config.
In short: we upgraded SyncForge into a much more real team workspace. It now has real auth/session control, admin management, banning, invite emails, persistent members, realtime chat/notifications, task completion, reliable comments, real assignees, and Gemini AI task generation.

























// IN DETAIL:

Auth & Login
We fixed Google/GitHub OAuth config issues by aligning the app’s callback flow with the correct backend callback URLs. The important idea is: frontend origin goes in Google “Authorized JavaScript origins”, while backend callback path goes in “Authorized redirect URIs”.
We also improved login/session safety:
• Added JWT_SECRET based session validation..
• OAuth/local login now checks whether the email is banned..
• If a banned user tries to log in, the frontend shows a popup instead of failing silently..
• If an active user gets banned while logged in, the backend emits a realtime auth:banned event and the frontend logs them out..
Team Invites
We added real email invites using Gmail SMTP from the backend. When an admin invites someone, the backend:
• Saves the invited user..
• Builds a join link..
• Sends an email through nodemailer..
• Uses SMTP_USER, SMTP_PASS, and SMTP_FROM from backend/.env..
We also fixed the issue where invited members vanished on reload by persisting them in the database instead of only frontend state.
Team Management
We added admin-only user management in TeamDirectory.
Admins can now:
• Edit name, email, role/position, status..
• Make a user admin..
• Delete a user..
• Ban an email..
• Shadow ban for days..
• Permanently ban..
Then we changed the UI from a “Manage” text button to a three-dot actions menu. We also fixed the dropdown overflow/clipping so the menu appears outside the table instead of being hidden.
The backend protects these operations with admin checks, so non-admin users cannot perform them even if they try manually.
Ban System
We added a persistent banned_emails database table. It stores:
• Email.
• User ID.
• Ban type: shadow/permanent.
• Expiry date for shadow bans.
• Reason.
• Created timestamp.
Ban behavior now works like this:
• Permanent ban: email can never log in/signup again..
• Shadow ban: email cannot log in until the expiry date..
• Banned users are deleted from active users..
• Banned email cannot be reinvited..
• Banned email cannot sign up with Google/GitHub/local login..
• Frontend shows a clear message like “You can’t log in until X because you are shadow banned.”.
Tasks
We fixed assigned task comments not updating in the UI by making comments persist and update state correctly.
We fixed comment timestamps too. Previously old comments could still show “Just now”; now timestamps use the real saved creation time and display relative time correctly.
We added task completion:
• Task details modal has a status option..
• Kanban cards have a quick complete/check button..
• Completing a task moves it to Done and syncs with the backend..
Inbox / Messaging
We added realtime message rendering with Socket.IO.
Now when someone sends a message:
• Backend saves it..
• Backend emits message:received..
• Frontend receives it immediately..
• The active chat updates without refresh..
• If you are not on the chat screen, you get a realtime notification/toast..
We also added message notifications into the header notification list.
Then we added member tagging:
• Type @ in chat..
• It shows team member suggestions..
• Selecting one inserts the mention..
• Mentions render highlighted in messages..
We also fixed the Inbox page scroll issue:
• Chat was using h-screen inside an app layout that already had a header..
• I changed it to use available height only..
• Now the page itself does not scroll; only the message feed/side panels scroll internally..
Team Directory UI Fixes
We fixed the Actions button not being clickable for admins. This was a layering/layout issue around the actions cell/dropdown. The menu now responds correctly and is usable by admins.
AI Task Generation
Latest feature: Gemini AI task helper in Projects/Add Task.
What was added:
• Backend endpoint: /api/ai/tasks/draft.
• Uses GEMINI_API_KEY from backend/.env.
• Frontend helper: generateTaskDraft.
• Add Task modal now has a sparkle AI icon and AI brief input..
• User can type something like “create backend auth cleanup task” and click the AI icon..
• AI returns structured JSON:.
◦ Title.
◦ Description.
◦ Priority.
◦ Tags.
◦ Best assignee ID.
I kept Gemini on the backend so your API key is not exposed in browser code. The frontend only asks the backend for a generated draft.
Real Members in Assignee
The Add Task assignee dropdown now fetches real users from /api/users. Before, it used hardcoded seeded users from data.ts, so invited/real members did not show properly. Now the assignee list matches actual team members from the database.
Files Touched Most
The main work happened in:
• backend/server.js: APIs, bans, invites, realtime events, Gemini endpoint..
• backend/config/passport.js: OAuth login ban checks..
• frontend/src/components/TeamDirectory.tsx: admin actions and invite/manage UI..
• frontend/src/components/TaskBoard.tsx: task completion, real assignees, AI generation..
• frontend/src/components/TaskDetailsModal.tsx: comments/status behavior..
• frontend/src/components/Chat.tsx: realtime messages and mentions..
• frontend/src/App.tsx: notifications, session handling, auth ban handling..
• frontend/src/api.ts: frontend API functions..
• .env.example: documented required env variables..



we turned SyncForge from a mostly local/demo project board into a more real collaborative workspace with auth safety, admin controls, persistent team invites, realtime messaging, notifications, task workflows, and AI-assisted task creation.