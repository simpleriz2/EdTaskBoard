import { useEffect, useState } from 'react';
import { createTLStore, defaultShapeUtils, TLRecord, TLStoreWithStatus } from '@tldraw/tldraw';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function useYjsStore({ roomId, hostUrl }: { roomId: string, hostUrl: string }) {
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({ status: 'loading' });

  useEffect(() => {
    const doc = new Y.Doc();
    const room = new WebsocketProvider(hostUrl, roomId, doc);
    const yRecords = doc.getMap<TLRecord>(`tldraw_${roomId}`);
    
    const store = createTLStore({ shapeUtils: defaultShapeUtils });
    
    // Load initial state once websocket connects and syncs
    room.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        const initialRecords = yRecords.toJSON();
        if (Object.keys(initialRecords).length > 0) {
          store.mergeRemoteChanges(() => {
            store.put(Object.values(initialRecords));
          });
        }
        setStoreWithStatus({ store, status: 'synced-remote', connectionStatus: 'online' });
      }
    });

    room.on('status', (event: { status: 'connected' | 'disconnected' | 'connecting' }) => {
      setStoreWithStatus((s) => ({ 
        ...(s as any),
        store, 
        status: event.status === 'connected' ? 'synced-remote' : 'synced-local',
        connectionStatus: event.status === 'connected' ? 'online' : 'offline' 
      }));
    });

    // 1. Sync tldraw -> yjs
    const unlisten = store.listen((tldrawEvent) => {
      if (tldrawEvent.source !== 'user') return;
      doc.transact(() => {
        for (const record of Object.values(tldrawEvent.changes.added)) {
          yRecords.set(record.id, record);
        }
        for (const [, record] of Object.values(tldrawEvent.changes.updated)) {
          yRecords.set(record.id, record);
        }
        for (const record of Object.values(tldrawEvent.changes.removed)) {
          yRecords.delete(record.id);
        }
      });
    }, { source: 'user', scope: 'document' });

    // 2. Sync yjs -> tldraw
    const observeYjs = (event: Y.YMapEvent<any>) => {
      const added: TLRecord[] = [];
      const updated: TLRecord[] = [];
      const removed: TLRecord['id'][] = [];

      event.changes.keys.forEach((change, key) => {
        const id = key as TLRecord['id'];
        if (change.action === 'add') {
          added.push(yRecords.get(id)!);
        } else if (change.action === 'update') {
          updated.push(yRecords.get(id)!);
        } else if (change.action === 'delete') {
          removed.push(id);
        }
      });

      if (added.length || updated.length || removed.length) {
        store.mergeRemoteChanges(() => {
          if (added.length) store.put(added);
          if (updated.length) store.put(updated);
          if (removed.length) store.remove(removed);
        });
      }
    };
    yRecords.observe(observeYjs);

    return () => {
      unlisten();
      yRecords.unobserve(observeYjs);
      room.disconnect();
      doc.destroy();
    };
  }, [roomId, hostUrl]);

  return storeWithStatus;
}
