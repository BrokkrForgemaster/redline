# Mobile Acceptance Checklist

## Core Layout

- 360 px viewport has no horizontal scroll.
- Touch targets are at least 44 px, preferably 48 px for primary actions.
- iOS safe areas are respected.
- Bottom navigation for field users: My Jobs, Active Job, Sync, Account.
- Primary action area is thumb-reachable.
- Cards are used instead of tables for field workflows.

## Field Screens

- Login
- My Jobs / Today
- Job detail
- Property/site detail and navigation action
- GPS verification
- Active service
- Checklist
- Photos
- Notes/issues
- Materials/equipment
- Finish/submit review
- Sync center
- Account/logout

## Offline and Sync

- Clear offline/sync status is visible.
- Offline starts are marked provisional.
- Pending mutations and media are visible in Sync center.
- UI does not claim synced until server acknowledgement.
- Field cache contains only assigned work, related properties, and required templates.

## Tracking

- Tracking status indicator is visible while clocked in/on duty.
- Permission denial/revocation is visible and recorded.
- App does not silently imply healthy tracking when OS restrictions prevent it.
- Native background tracking must be validated on real iPhone and Android devices.

## Manual Validation Required

- Real iPhone Safari/PWA
- Real Android Chrome/PWA
- Camera permission
- Location permission
- Airplane/offline mode
- App backgrounded and screen locked while tracking
- Temporary cellular loss and later sync
- Location permission revoked/restored
- Device reboot/app relaunch recovery
- App killed/reopened mid-job
