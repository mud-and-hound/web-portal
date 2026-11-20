# Mud & Hound Web Portal

- [หน้ารวมระบบงาน](https://mud-and-hound.github.io/web-portal/)
- [จัดการลิงก์](https://mud-and-hound.github.io/web-portal/admin.html)

หน้าเว็บเผยแพร่จาก GitHub Pages ที่สาขา `main` และอ่านรายการจาก Supabase เมื่อเชื่อมฐานข้อมูลแล้ว หน้าแอดมินใช้ Supabase Auth เพื่อยืนยันบัญชีอีเมลที่ได้รับสิทธิ์

เพิ่มหรือแก้ไขลิงก์ได้ในหน้าแอดมิน กด **ซ่อน** เพื่อนำรายการออกจากหน้าแรก และ **กู้คืน** เพื่อนำกลับมาแสดง RentHub เริ่มต้นแบบซ่อนจนกว่าจะมี URL

## ตั้งค่า

1. ใช้ `supabase/001_portal.sql` กับฐานข้อมูลของโปรเจกต์นี้
2. เพิ่มอีเมลแอดมินที่ยืนยันตัวตนได้ใน `private.portal_admins` ผ่าน Supabase Dashboard ใส่ URL หน้าแอดมินใน Auth Redirect URLs และตั้งค่า SMTP สำหรับส่งอีเมลยืนยันและรีเซ็ตรหัสผ่าน
3. ใส่ Project URL และ publishable key ใน `config.js`
4. โหลดรายการตั้งต้นจาก `seed.json` เข้า `public.portal_links` หนึ่งครั้ง

ดูตัวอย่างหน้าเว็บในเครื่องด้วย `python3 -m http.server 8080`
