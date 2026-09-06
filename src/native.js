import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Contacts } from '@capacitor-community/contacts'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { Share } from '@capacitor/share'

export const isNative = Capacitor.isNativePlatform()

export async function lightTap() {
  if (!isNative) return
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}

export async function hideKeyboard() {
  if (!isNative) return
  await Keyboard.hide().catch(() => {})
}

export async function pickChatPhoto() {
  if (!isNative) return null
  return Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Prompt,
  }).catch(() => null)
}

export async function shareWaveInvite() {
  if (!isNative) return false
  await Share.share({
    title: 'Wave',
    text: 'Join me on Wave.',
  }).catch(() => {})
  return true
}

export async function readDeviceContacts() {
  if (!isNative) return []

  const permission = await Contacts.requestPermissions().catch(() => null)
  if (permission?.contacts && permission.contacts !== 'granted') return []

  const result = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
    },
  }).catch(() => ({ contacts: [] }))

  return result.contacts || []
}
