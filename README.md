# MedTrack - Medication Tracker

A simple, privacy-focused medication tracking app that works entirely in your browser. Track medications for yourself and family members with no server required.

## Features

✅ **Multi-Person Support** - Track medications for multiple family members
✅ **OCR Scanning** - Take a photo of medication bottles to auto-fill information
✅ **Medication Reminders** - Browser notifications for scheduled doses
✅ **Offline Support** - Works without internet connection
✅ **Data Export/Import** - Backup and restore your data as JSON with timestamped filenames
✅ **Auto-Backup Reminders** - Optional 30-day backup reminders to prevent data loss
✅ **Privacy First** - All data stored locally on your device
✅ **Data Persistence Warning** - Welcome screen explains data storage limitations
✅ **Complete Data Reset** - Securely delete all data when needed
✅ **Settings Panel** - Centralized management for all app features
✅ **Mobile Friendly** - Install as a PWA on your phone

## Quick Start

### Local Development

1. Simply open `index.html` in a modern web browser
2. That's it! No build step required.

**Important for Existing Users:** If you're updating from a previous version, you may need to refresh the page or clear your browser cache for new features to work properly. The database will automatically upgrade to support dose tracking.

For best experience, use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`

## Deployment

### GitHub Pages

1. Create a new GitHub repository
2. Upload all files to the repository
3. Go to Settings > Pages
4. Select "Deploy from branch" and choose `main` branch
5. Your app will be live at `https://yourusername.github.io/medtrack`

### Netlify

1. Drag and drop the folder to Netlify Drop (https://app.netlify.com/drop)
2. Or connect your GitHub repo for automatic deployments

### Vercel

```bash
npm install -g vercel
vercel
```

### Any Static Host

Upload all files to:
- AWS S3 + CloudFront
- Google Cloud Storage
- Firebase Hosting
- Cloudflare Pages
- Azure Static Web Apps

## File Structure

```
medtrack/
├── index.html          # Main HTML file
├── styles.css          # Styling
├── app.js              # Application logic
├── manifest.json       # PWA manifest
├── sw.js              # Service worker for PWA
└── README.md          # This file
```

## Browser Support

- Chrome/Edge 88+
- Safari 14+
- Firefox 85+

## Features Explained

### Adding People

1. Click "Add Person" to create profiles for family members
2. Switch between people using the person pills at the top

### Adding Medications

1. Click the + button
2. Either scan a medication label with your camera or enter manually
3. Set dosage, frequency, and schedule times
4. Add optional notes (e.g., "Take with food")

### Scanning Medications

The OCR feature uses Tesseract.js to extract information from medication labels. For best results:
- Take clear, well-lit photos
- Ensure text is straight and in focus
- Review and correct extracted information

### Reminders

The app uses browser notifications. You'll be asked for permission on first use. 

**Note:** Browser notifications work differently on mobile:
- **iOS**: Reminders only work when app is open
- **Android**: Full notification support via PWA

For production-grade reminders, consider integrating with a backend service.

### Data Export/Import

- **Export**: Click the download icon to save your data as JSON (includes date/time in filename)
- **Import**: Access via Settings → Import Data to restore from a backup

Your data is stored in IndexedDB and persists across sessions.

### Settings Panel

Access settings via the gear icon to:
- **Export/Import data** - Manage your backups
- **Auto-backup reminders** - Toggle 30-day backup reminders
- **Notification settings** - Enable/check medication reminders
- **Reset app** - Completely delete all data (requires double confirmation)

### Welcome Screen

First-time users see a welcome screen that:
- Explains local-only data storage
- Warns about data persistence limitations
- Recommends regular backups
- Highlights the importance of exporting data

This screen only shows once and can be bypassed for returning users.

### Backup Reminders

When enabled in Settings:
- App reminds you every 30 days to backup your data
- Reminder shows 2 seconds after app loads
- Option to backup immediately or snooze for 30 days
- Tracks last backup to avoid reminder spam

## Privacy & Security

- **No tracking**: No analytics or third-party services
- **Local storage**: All data stays on your device
- **No accounts**: No registration required
- **Offline first**: Works without internet

## Data Safety & Backups

**IMPORTANT:** Your data can be lost if you:
- Clear browser data (especially "site data" or "cookies")
- Uninstall the app or browser
- Use private/incognito mode (data deleted when closed)
- Run out of device storage (browser may purge data)

**Best Practices:**
1. Enable auto-backup reminders in Settings
2. Export your data regularly (especially before browser updates)
3. Keep exported JSON files in multiple safe locations (cloud storage, email, USB drive)
4. Test your backup by importing it occasionally

**Export Filename Format:**
`medtrack-backup-2026-02-16-14-30-45.json`
(Includes date and time for easy identification)

## Data Storage

Data is stored in your browser's IndexedDB. Storage limits:
- Chrome/Edge: ~10% of disk space
- Safari: ~1GB
- Firefox: ~2GB

To completely reset the app, clear your browser's site data.

## Resetting the App

**Via Settings Panel (Recommended):**
1. Open Settings (gear icon)
2. Scroll to "Danger Zone"
3. Click "Delete All Data"
4. Confirm twice (safety measure)
5. App resets with a fresh default person

**Via Browser (Complete Wipe):**
- **Chrome**: Settings → Privacy → Clear browsing data → Cookies and site data
- **Safari**: Settings → Safari → Advanced → Website Data → Remove
- **Firefox**: Settings → Privacy → Cookies and Site Data → Manage Data

The in-app reset is safer as it only deletes medication data while preserving browser settings.

## Development

### Customization

**Colors**: Edit CSS variables in `styles.css`
```css
:root {
    --primary-600: #2563eb;  /* Main color */
    --accent-600: #059669;   /* Success/accent */
}
```

**Fonts**: Currently uses DM Sans + Fraunces from Google Fonts. Swap in `index.html`

## Limitations

- OCR accuracy varies with image quality
- Notifications reset on browser/device restart (use backend for persistent reminders)
- IndexedDB storage can be cleared by browser (always maintain backups)

## Future Enhancements

Potential improvements you could add:
- Medication history tracking
- Refill reminders
- Drug interaction checking
- Barcode scanning
- Cloud sync (requires backend)

## License

MIT License - Free to use, modify, and distribute

## Support

For issues or questions, please create an issue on GitHub.

---

**Medical Disclaimer**: This app is for informational purposes only. Always consult healthcare professionals for medical advice.
