import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: [
        'index.html',
        'invite-code.html',
        'waitlist-application.html',
        'admin-dashboard.html',
        'staff-dashboard.html',
        'coordinator-dashboard.html',
        'parent-dashboard.html',
        'manage-applications.html',
        'sessions-dashboard.html',
      ],
    },
  },
})
