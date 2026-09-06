# Wave iOS App Build

Wave is wrapped as a native iOS app with Capacitor. The iOS project lives in `ios/App`.

Native plugins included:

- App lifecycle
- Camera and photo picker
- Filesystem
- Geolocation
- Haptics
- Keyboard
- Preferences
- Push notifications
- Share sheet
- Splash screen
- Status bar

## Sync app changes into iOS

```bash
npm install
npm run ios:sync
```

Run this after every React, CSS, or Supabase client change.

## Install on an iPhone

```bash
npm run ios:open
```

In Xcode:

1. Open `ios/App/App.xcworkspace`.
2. Select the `App` target.
3. Set your Apple Developer Team.
4. Connect your iPhone.
5. Press Run.

## Update while the app is installed

After changing code:

```bash
npm run ios:sync
```

Then press Run again in Xcode. The app updates in place on the iPhone.

## Windows note

The iOS wrapper can be generated and synced on Windows, but final iPhone builds require macOS with Xcode and CocoaPods. Apple does not allow iOS apps to be compiled, signed, or installed from Windows.
