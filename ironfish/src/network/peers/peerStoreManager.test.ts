/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
jest.mock('ws')

import {
  getConnectedPeer,
  getConnectingPeer,
  getDisconnectedPeer,
  mockLocalPeer,
  mockPeerStore,
} from '../testUtilities'
import { Peer } from './peer'
import { PeerAddress } from './peerAddress'
import { PeerManager } from './peerManager'
import { MAX_PEER_ADDRESSES, PeerStoreManager } from './peerStoreManager'

jest.useFakeTimers()

describe('PeerStoreManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers({ legacyFakeTimers: false })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('removePeer should remove a peer address', async () => {
    const now = Date.now()
    jest.setSystemTime(now)

    const peerStore = mockPeerStore()
    const localPeer = mockLocalPeer()
    const pm = new PeerManager(localPeer, peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(0)

    const { peer: peer1 } = getConnectedPeer(pm)
    await peerStoreManager.addPeer(peer1)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)

    const { peer: peer2 } = getConnectedPeer(pm)
    await peerStoreManager.addPeer(peer2)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(2)

    await peerStoreManager.removePeer(peer1)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)

    const peer2Address = {
      address: peer2.address,
      port: peer2.port,
      identity: peer2.state.identity,
      name: peer2.name,
      lastAddedTimestamp: now,
    }

    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(peer2Address)

    await peerStoreManager.removePeer(peer2)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(0)
  })

  it('Confirming the functionality even when voiding the remove and add peer functions', () => {
    const now = Date.now()
    jest.setSystemTime(now)

    const peerStore = mockPeerStore()
    const localPeer = mockLocalPeer()
    const pm = new PeerManager(localPeer, peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(0)

    const { peer: peer1 } = getConnectedPeer(pm)
    void peerStoreManager.addPeer(peer1)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)

    const { peer: peer2 } = getConnectedPeer(pm)
    void peerStoreManager.addPeer(peer2)

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(2)

    void peerStoreManager.removePeer(peer1)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)

    const peer2Address = {
      address: peer2.address,
      port: peer2.port,
      identity: peer2.state.identity,
      name: peer2.name,
      lastAddedTimestamp: now,
    }

    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(peer2Address)

    void peerStoreManager.removePeer(peer2)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(0)
  })

  it('only connected peers get added to the address manager', async () => {
    const now = Date.now()
    jest.setSystemTime(now)

    const peerStore = mockPeerStore()
    const pm = new PeerManager(mockLocalPeer(), peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)
    peerStoreManager.peerStore = peerStore
    const { peer: connectedPeer } = getConnectedPeer(pm)
    const { peer: connectingPeer } = getConnectingPeer(pm)
    const disconnectedPeer = getDisconnectedPeer(pm)
    const allPeers: Peer[] = [connectedPeer, connectingPeer, disconnectedPeer]

    for (const peer of allPeers) {
      await peerStoreManager.addPeer(peer)
    }

    const connectedPeerAddress = {
      address: connectedPeer.address,
      port: connectedPeer.port,
      identity: connectedPeer.state.identity,
      name: connectedPeer.name,
      lastAddedTimestamp: now,
    }

    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(connectedPeerAddress)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)
  })

  it('if more than MAX_PEER_ADDRESSES, then only load MAX_PEER_ADDRESSES peers', () => {
    const peerStore = mockPeerStore()
    const pm = new PeerManager(mockLocalPeer(), peerStore)
    const { peer: connectedPeer } = getConnectedPeer(pm)
    const peerAddress = {
      address: connectedPeer.address || '',
      port: connectedPeer.port || 0,
      identity: connectedPeer.state.identity,
      name: connectedPeer.name,
      lastAddedTimestamp: Date.now(),
    }
    peerStore.set(
      'priorPeers',
      Array.from({ length: MAX_PEER_ADDRESSES + 10 }, () => {
        const randomIdentity = Math.random().toString(36).substring(7)
        return {
          ...peerAddress,
          identity: randomIdentity,
        }
      }),
    )

    const peerStoreManager = new PeerStoreManager(peerStore)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(MAX_PEER_ADDRESSES)
  })

  it('addPeer should remove the oldest peer if the address manager is full', async () => {
    const oldestNow = Date.now()
    jest.setSystemTime(oldestNow)

    const peerStore = mockPeerStore()
    const pm = new PeerManager(mockLocalPeer(), peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)

    const { peer: oldestPeer } = getConnectedPeer(pm)
    await peerStoreManager.addPeer(oldestPeer)
    const oldestPeerAddress = {
      address: oldestPeer.address,
      port: oldestPeer.port,
      identity: oldestPeer.state.identity,
      name: oldestPeer.name,
      lastAddedTimestamp: oldestNow,
    }

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(oldestPeerAddress)

    const newNow = oldestNow + 1000
    jest.setSystemTime(newNow)

    const { peer: newPeer } = getConnectedPeer(pm)
    await peerStoreManager.addPeer(newPeer)
    const newPeerAddress = {
      address: newPeer.address,
      port: newPeer.port,
      identity: newPeer.state.identity,
      name: newPeer.name,
      lastAddedTimestamp: newNow,
    }

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(2)
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(newPeerAddress)

    for (let i = 0; i < MAX_PEER_ADDRESSES - 1; i++) {
      const randomIdentity = Math.random().toString(36).substring(7)
      await peerStoreManager.addPeer({
        ...newPeer,
        state: {
          ...newPeer.state,
          identity: randomIdentity,
        },
      } as Peer)
    }

    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(MAX_PEER_ADDRESSES)
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(newPeerAddress)
    // The oldest peer should have been removed
    expect(peerStoreManager.priorConnectedPeerAddresses).not.toContainEqual(oldestPeerAddress)
  })

  it('addPeer should update peer timestamp if it is already in the address manager', async () => {
    const now = Date.now()
    const newNow = now + 1000
    jest.setSystemTime(now)

    const peerStore = mockPeerStore()
    const pm = new PeerManager(mockLocalPeer(), peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)
    const { peer } = getConnectedPeer(pm)
    await peerStoreManager.addPeer(peer)
    const peerAddress = {
      address: peer.address,
      port: peer.port,
      identity: peer.state.identity,
      name: peer.name,
      lastAddedTimestamp: now,
    }
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(peerAddress)

    jest.setSystemTime(newNow)
    await peerStoreManager.addPeer(peer)
    expect(peerStoreManager.priorConnectedPeerAddresses.length).toEqual(1)
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual({
      ...peerAddress,
      lastAddedTimestamp: newNow,
    })
  })

  it('save should persist connected peers', async () => {
    const now = Date.now()
    jest.setSystemTime(now)
    const peerStore = mockPeerStore()

    const pm = new PeerManager(mockLocalPeer(), peerStore)
    const peerStoreManager = new PeerStoreManager(peerStore)
    peerStoreManager.peerStore = peerStore
    const { peer: connectedPeer } = getConnectedPeer(pm)
    const address: PeerAddress = {
      address: connectedPeer.address || '',
      port: connectedPeer.port || 0,
      identity: connectedPeer.state.identity || '',
      name: connectedPeer.name,
      lastAddedTimestamp: now,
    }

    await peerStoreManager.addPeer(connectedPeer)
    await peerStoreManager.save()
    expect(peerStoreManager.priorConnectedPeerAddresses).toContainEqual(address)
  })
})
