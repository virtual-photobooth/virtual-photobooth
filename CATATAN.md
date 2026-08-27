# VIRTUAL PHOTOBOOTH
## PROJECT MASTER NOTE

Status: Initial Development
Version: 1.0

---

# 1. PRODUCT OVERVIEW

Virtual Photobooth adalah platform photobooth berbasis website.

Platform ini digunakan untuk membuat dan mengelola banyak event.

Konsep utama:

ONE PLATFORM
→ MANY EVENTS
→ EACH EVENT HAS ITS OWN PHOTOGRAPHY EXPERIENCE

Platform bukan website yang hanya dibuat untuk satu event.

Owner harus dapat membuat banyak event dari satu dashboard.

Contoh:

Event 001
Celine & Brian Wedding

Event 002
Kevin Birthday

Event 003
ABC Corporate Event

Semua event menggunakan sistem/platform yang sama.

---

# 2. CORE PRINCIPLE

EVENT adalah pusat dari sistem.

Setiap event memiliki:

- event_id
- nama event
- tanggal event
- client
- unique slug
- unique URL
- QR Code
- PNG frame sendiri
- jumlah foto
- countdown
- voice guestbook setting
- voice retention
- guests
- photos
- voice messages
- event status

Semua data harus terhubung dengan event_id.

Jangan pernah mencampurkan data antar-event.

---

# 3. USER TYPES

Sistem memiliki tiga jenis pengguna:

1. OWNER / ADMIN
2. CLIENT
3. GUEST

---

# 4. OWNER / ADMIN

Owner adalah pemilik platform.

Owner memiliki akses ke seluruh event.

Owner dapat:

- Login
- Melihat dashboard
- Membuat client
- Mengedit client
- Membuat event
- Mengedit event
- Mengaktifkan event
- Menonaktifkan event
- Menghapus event jika diperlukan
- Upload PNG frame untuk setiap event
- Mengganti PNG frame
- Mengatur jumlah foto
- Mengatur countdown
- Mengaktifkan voice guestbook
- Menonaktifkan voice guestbook
- Mengatur voice retention
- Melihat guest
- Melihat photos
- Melihat voice messages
- Melihat statistik
- Melihat storage usage
- Mengelola event

---

# 5. CLIENT

Client adalah pemilik atau penyelenggara event.

Client hanya boleh melihat event yang dimilikinya.

Client tidak boleh melihat event milik client lain.

Client dapat:

- Login
- Melihat event
- Melihat jumlah guest
- Melihat guest list
- Melihat photo gallery
- Melihat voice guestbook
- Memutar voice message
- Download photo
- Download voice message
- Melihat informasi event

---

# 6. GUEST

Guest adalah tamu yang menggunakan photobooth.

Guest TIDAK perlu membuat akun.

Guest menggunakan browser HP.

Guest membuka:

/event/[slug]

Guest flow:

WELCOME
↓
CAMERA PERMISSION
↓
CAMERA
↓
COUNTDOWN
↓
CAPTURE PHOTO
↓
CAPTURE PHOTO
↓
CAPTURE PHOTO
↓
CAPTURE PHOTO
↓
GENERATE FINAL PHOTO
↓
DOWNLOAD PHOTO
↓
ENTER NAME
↓
OPTIONAL INSTAGRAM
↓
OPTIONAL VOICE MESSAGE
↓
THANK YOU

---

# 7. MOBILE FIRST

Guest experience wajib mobile-first.

Prioritas device:

- iPhone Safari
- Android Chrome

Guest interface harus dirancang untuk portrait mobile.

Jangan membuat desktop website lalu hanya mengecilkannya ke mobile.

Guest interface harus memiliki:

- tombol besar
- touch-friendly UI
- camera preview besar
- typography jelas
- minimal navigation
- minimal text
- loading state
- error state
- camera permission state
- microphone permission state
- upload state

Guest tidak perlu melihat dashboard.

Guest tidak perlu login.

Guest tidak perlu membuat account.

---

# 8. FRAME / TEMPLATE SYSTEM

CRITICAL REQUIREMENT.

Setiap EVENT memiliki PNG FRAME sendiri.

Tidak menggunakan template global pada versi awal.

Contoh:

Event 001
→ frame-celine.png

Event 002
→ frame-kevin.png

Event 003
→ frame-abc.png

Owner upload PNG langsung di dalam event.

---

# 9. FRAME FORMAT

Semua frame wajib:

PORTRAIT

Aspect ratio:

2:3

Recommended size:

2160 × 3240 px

Format:

PNG

Frame dapat menggunakan transparent background untuk area foto.

Jangan mendukung landscape frame pada versi awal.

Jika frame landscape:

ERROR

Contoh:

"Invalid frame format.
Please upload a portrait PNG with a 2:3 aspect ratio."

Jangan stretch atau distort frame.

---

# 10. FINAL PHOTO

Final photo juga wajib:

PORTRAIT

Aspect ratio:

2:3

Recommended:

2160 × 3240 px

Final photo dibuat dari:

CAPTURED PHOTOS
+
EVENT PNG FRAME

↓

IMAGE COMPOSITING

↓

FINAL PHOTO

PNG frame adalah overlay.

Captured photos berada di bawah frame.

Jangan mengubah aspect ratio frame.

Jangan melakukan stretching pada frame.

---

# 11. PHOTO COUNT

Jumlah foto harus configurable per event.

Contoh:

Event A:
4 photos

Event B:
3 photos

Event C:
5 photos

Jangan hardcode jumlah foto untuk seluruh platform.

Jumlah foto harus berasal dari konfigurasi event.

---

# 12. COUNTDOWN

Countdown configurable per event.

Default:

3 seconds

Contoh:

3
2
1
CAPTURE

Countdown berikutnya dimulai sampai jumlah foto selesai.

---

# 13. EVENT URL

Setiap event memiliki unique slug.

Contoh:

Event:
Celine & Brian Wedding

Slug:
celine-brian

URL:

/event/celine-brian

URL harus mengarah hanya ke event tersebut.

---

# 14. QR CODE

Setiap event memiliki QR Code sendiri.

QR mengarah ke:

/event/[slug]

Owner dapat:

- melihat QR
- copy URL
- download QR

QR Event A tidak boleh mengarah ke Event B.

---

# 15. VOICE GUESTBOOK

Voice guestbook adalah fitur optional.

Jika enabled:

Guest dapat memilih:

"Leave a message"

Guest dapat:

- Start recording
- Stop recording
- Listen to recording
- Record again
- Send

Voice message dikaitkan dengan:

event_id
guest_id

Gunakan browser MediaRecorder API jika sesuai.

---

# 16. VOICE RETENTION

Voice messages memiliki expiration.

Default:

7 DAYS

Contoh:

Event:
20 August 2026

Retention:
7 days

Expiration:
27 August 2026

Setelah expired:

1. Delete audio file from Storage
2. Delete database record
3. Pastikan file tidak dapat diakses lagi

Jangan hanya menghapus database record.

File fisik audio di storage juga harus dihapus.

Gunakan scheduled job / cron yang reliable.

---

# 17. STORAGE

Gunakan Supabase Storage.

Media:

- Event frame PNG
- Final photos
- Original photos jika diperlukan
- Voice recordings

Contoh struktur:

events/
    {event_id}/
        frame/
            frame.png

        photos/
            ...

        voices/
            ...

Jangan menyimpan binary media langsung di PostgreSQL.

Database hanya menyimpan metadata dan reference/path.

---

# 18. DATABASE

Initial entities:

users
clients
events
guests
photos
voice_messages

Basic relationship:

clients
↓
events
↓
guests
↓
photos
↓
voice_messages

Semua entity yang berkaitan dengan event harus memiliki hubungan ke event_id.

Contoh:

guests.event_id

photos.event_id

voice_messages.event_id

---

# 19. SECURITY

Gunakan Supabase Row Level Security.

CRITICAL:

Client A tidak boleh melihat Client B.

Client A tidak boleh melihat Event B.

Event A tidak boleh melihat data Event B.

Guest tidak boleh mendapatkan akses database secara bebas.

Jangan expose Supabase service-role key di client-side.

Gunakan secure access dan signed URLs jika diperlukan.

---

# 20. UI DIRECTION

Overall visual direction:

- Premium
- Minimal
- Clean
- Elegant
- Modern
- Editorial
- Event-focused

Guest:

Immersive photobooth experience.

Client:

Premium SaaS dashboard.

Owner:

Professional admin dashboard.

Jangan membuat guest experience seperti dashboard.

---

# 21. OWNER UI

Owner navigation:

Dashboard
Events
Clients
Storage
Analytics
Settings

Owner dashboard menampilkan:

Total Events
Active Events
Total Clients
Total Guests
Total Photos
Total Voice Messages
Storage Usage

Owner dapat melihat seluruh event.

---

# 22. CLIENT UI

Client navigation:

Home
Guests
Photos
Voice
Settings

Client dashboard menampilkan:

Total Guests
Total Photos
Total Voice Messages

Recent Memories

Guest:

Name
Photo
Voice
Timestamp

---

# 23. GUEST UI

Guest tidak membutuhkan navigation bar.

Flow:

WELCOME
↓
CAMERA
↓
PHOTO
↓
NAME
↓
VOICE
↓
THANK YOU

Semua tampilan portrait.

---

# 24. TECH STACK

Preferred:

Frontend:
Next.js

Language:
TypeScript

Styling:
Tailwind CSS

Backend:
Supabase

Database:
PostgreSQL

Authentication:
Supabase Auth

Storage:
Supabase Storage

Photo processing:
Canvas API atau image processing solution yang sesuai

Voice recording:
MediaRecorder API

---

# 25. DEVELOPMENT PHASES

Do NOT build everything at once.

---

## PHASE 1 — FOUNDATION

Build:

- Next.js setup
- Supabase connection
- Authentication
- Database schema
- RLS
- Owner dashboard
- Client model
- Event model
- Create event
- Edit event
- Event slug
- Event list
- Upload PNG frame
- Supabase Storage

STOP after Phase 1.

Do not implement Phase 2 until explicitly instructed.

---

## PHASE 2 — GUEST PHOTOBOOTH

Build:

- Event URL
- Welcome
- Camera permission
- Camera preview
- Countdown
- Multiple photo capture
- Portrait handling
- PNG frame compositing
- Final photo
- Download

STOP after Phase 2.

---

## PHASE 3 — GUEST DATA

Build:

- Guest name
- Instagram optional
- Guest record
- Photo record
- Event association

STOP after Phase 3.

---

## PHASE 4 — VOICE

Build:

- Microphone permission
- Recording
- Stop
- Preview
- Record again
- Upload
- Voice record
- Expiration
- Automatic deletion

STOP after Phase 4.

---

## PHASE 5 — CLIENT DASHBOARD

Build:

- Client login
- Dashboard
- Guests
- Photos
- Voice messages
- Download

STOP after Phase 5.

---

## PHASE 6 — PRODUCTION

Build:

- QR generation
- Analytics
- Storage monitoring
- Error handling
- Loading states
- Permission handling
- Performance optimization
- Security review
- Mobile Safari testing
- Android Chrome testing

---

# 26. DEVELOPMENT RULE

Do not make assumptions that change the product concept.

If a requirement is unclear:

ASK before implementing.

Do not replace agreed requirements with your own idea.

Do not add unnecessary features.

Do not build future phases before the current phase is stable.

---

# 27. TESTING

After each phase:

Run:

- npm run lint
- npm run build
- type checking
- relevant tests

Fix errors before proceeding.

Test responsive behavior.

Test mobile browser behavior.

Especially:

iPhone Safari
Android Chrome

---

# 28. IMPORTANT PRODUCT RULES

These rules are fixed:

1. One platform supports many events.
2. Every event has a unique event_id.
3. Event data must remain isolated.
4. Every event has its own PNG frame.
5. PNG frame must be portrait.
6. Frame aspect ratio is 2:3.
7. Final photo is portrait 2:3.
8. Guest experience is mobile-first.
9. Guest does not need an account.
10. Voice message is optional.
11. Voice has automatic expiration.
12. Default voice retention is 7 days.
13. Expired voice files must actually be deleted from storage.
14. Client can only access their own events.
15. Owner can access all events.
16. Event-specific frame is uploaded by owner.
17. No global template system in initial version.
18. Do not create separate applications for different events.
19. Do not distort PNG frames.
20. Do not mix event data.
21. Do not hardcode one event into the application.
22. Do not hardcode photo count globally.
23. Do not hardcode voice retention globally.
24. Do not build all phases at once.

---

# 29. FINAL PRODUCT EXPERIENCE

OWNER:

Login
→ Dashboard
→ Clients
→ Events
→ Create Event
→ Upload PNG
→ Generate QR
→ Manage Event

CLIENT:

Login
→ Event Dashboard
→ Guests
→ Photos
→ Voice Messages

GUEST:

Scan QR
→ Open Event
→ Start
→ Camera
→ Photos
→ Final Photo
→ Name
→ Voice
→ Thank You

---

# 30. SCALABILITY

The architecture must support:

3 events
→ 10 events
→ 100 events
→ 1,000+ events

without fundamental architectural rewrite.

The system must remain event-based and scalable.

---

# CURRENT DEVELOPMENT STATUS

Phase 1 has not been approved for implementation yet.

First task:

Analyze this document.

Then provide:

1. Architecture proposal
2. Database schema proposal
3. Supabase RLS strategy
4. Storage structure
5. Next.js folder structure
6. Required environment variables
7. Phase 1 implementation plan

DO NOT start coding yet.

Wait for approval before implementing Phase 1.
