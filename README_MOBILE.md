# Mobile App Build Instructions

## Configuration
The app is currently configured to point to the production server:
- **URL:** `https://danesha-pos.vercel.app`
- **Config File:** `capacitor.config.ts`

## Prerequisites
To build the APK, you need:
1. **Java Development Kit (JDK) 17** or later.
2. **Android Studio** (with Android SDK installed).

## Building the APK (Debug)

Since the project is already synced, you can build the APK using the following command in your terminal (make sure you are in the project root):

```bash
# 1. Sync the project (from project root)
npx cap sync

# 2. Build the APK (enter android directory first)
cd android
./gradlew assembleDebug
```

The output APK will be located at:
`android/app/build/outputs/apk/debug/POS-Danesha-debug-v1.0.apk`

## Building for Production (Release)
To build a signed release APK:

1. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```
2. Go to **Build > Generate Signed Bundle / APK**.
3. Create a new Keystore (remember the password).
4. Select **Release** build variant.
5. Finish.

## Troubleshooting
If you encounter "Unable to locate a Java Runtime", ensure you have Java installed and `JAVA_HOME` environment variable set.
