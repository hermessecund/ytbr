import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

import { ImPlay3, ImPause2, ImForward3 } from 'react-icons/im'
import { IoInformation, IoCloseSharp } from 'react-icons/io5'

import astrosocket from './astrosocket'
import useLocalStorage from './useLocalStorage'
import YouTubeEmbed from './YouTubeEmbed'

import './styles/main.css'

function IgnoreButton({ onIgnore, visible }: { onIgnore: () => void; visible: boolean }) {
    const [clicked, setClicked] = useState(false)

    function onClick() {
        if (clicked) {
            onIgnore()
            setClicked(false)
        } else {
            setClicked(true)
        }
    }

    return (
        <button
            style={visible ? undefined : { visibility: 'hidden' }}
            title="Ignore videos from this channel"
            onClick={onClick}
            onMouseLeave={() => setClicked(false)}
            onBlur={() => setClicked(false)}
        >
            <IoCloseSharp />
            <span>{clicked ? 'SURE?' : 'IGNORE'}</span>
        </button>
    )
}

function CosmicIOApp() {
    const [queue, setQueue] = useLocalStorage<VideoID[]>('cosmic:queue', [])
    const [history, setHistory] = useLocalStorage<ViewHistoryEntry[]>('cosmic:history', [])
    const [{ value: viewMode }, setViewMode] = useLocalStorage<{ value: 0 | 1 | 2 | 3 }>(
        'cosmic:viewMode',
        { value: 1 },
    )
    const [playMode, setPlayMode] = useLocalStorage<'play' | 'pause'>('cosmic:playMode', 'play')

    const [ignoredVideos, setIgnoredChannels] = useLocalStorage<IgnoredVideos>('cosmic:ignored', {})
    const ignoredVideosArray = Object.entries(ignoredVideos)
        .sort((a, b) => {
            if (a[1] < b[1]) {
                return 1
            } else if (a[1] > b[1]) {
                return -1
            } else {
                return 0
            }
        })
        .map(([author]) => author)

    const [videoPaused, setVideoPaused] = useState(true)
    const [selectedHistoryVideo, setSelectedHistoryVideo] = useState<VideoID>('')

    const videosToPlay = selectedHistoryVideo ? [selectedHistoryVideo] : queue.slice(0, 2)

    function skipToNextVideo() {
        setQueue((q) => q.slice(1))
        setSelectedHistoryVideo('')
    }

    function ignoreVideosFromCurrentChannel() {
        const activeVideo = history.find((v) => v.id === videosToPlay[0])
        if (!activeVideo) {
            return
        }

        setIgnoredChannels((i) => ({
            ...i,
            [activeVideo.author]: new Date().toISOString(),
        }))
        setHistory((h) => h.filter((v) => v.author !== activeVideo.author))

        skipToNextVideo()
    }

    useEffect(function setupSocket() {
        const pastVideoIds = new Set([...queue, ...history.map((x) => x.id)])

        const videoLimitMargin = {
            lower: 20,
            upper: 100,
        }
        let stopAddingVideos = queue.length > videoLimitMargin.lower

        const sock = astrosocket()
        sock.on('video', (v: VideoPayload) => {
            if (pastVideoIds.has(v.video.id)) {
                return
            }

            setQueue((x) => {
                if (x.length >= videoLimitMargin.upper) {
                    stopAddingVideos = true
                } else if (x.length <= videoLimitMargin.lower) {
                    stopAddingVideos = false
                }

                if (stopAddingVideos) {
                    return x
                }

                pastVideoIds.add(v.video.id)
                return x.concat(v.video.id)
            })
        })

        return () => {
            sock.close()
        }
    }, [])

    useEffect(
        function setupHotkeys() {
            function onKeyPress(e: KeyboardEvent) {
                /* prettier-ignore */
                switch (e.key) {
                    case 'q': return setViewMode({ value: 1 })
                    case 'w': return setViewMode({ value: 2 })
                    case 'e': return setViewMode({ value: 3 })
                    case 'a': return setPlayMode(p => p === 'play' ? 'pause' : 'play')
                    case 's': return skipToNextVideo()
                }
            }

            window.addEventListener('keypress', onKeyPress)

            return () => window.removeEventListener('keypress', onKeyPress)
        },
        [skipToNextVideo],
    )

    const incomingRandomVideo = queue[0]
    useEffect(
        function manageAutoSwitch() {
            if (
                selectedHistoryVideo ||
                playMode !== 'play' ||
                !incomingRandomVideo ||
                videoPaused
            ) {
                return
            }

            const handle = setTimeout(() => {
                setQueue((q) => q.slice(1))
            }, 10000)

            return () => clearTimeout(handle)
        },
        [selectedHistoryVideo, playMode, incomingRandomVideo, videoPaused],
    )

    let appClassName = ''
    if (viewMode === 2 || viewMode === 3) {
        appClassName += ' hide-history'
    }
    if (viewMode === 3) {
        appClassName += ' hide-navbar'
    }

    return (
        <div id="app" className={appClassName}>
            <nav>
                <div className="content">
                    <div className="left">
                        <h1 title="The outer space of YouTube videos">cosmic.io</h1>
                    </div>
                    <div className="right">
                        {!selectedHistoryVideo && (
                            <>
                                <button
                                    className={playMode === 'play' ? 'active' : ''}
                                    title="Switch videos automatically (A)"
                                    onClick={() => setPlayMode('play')}
                                >
                                    <ImPlay3 />
                                </button>
                                <button
                                    className={playMode === 'pause' ? 'active' : ''}
                                    title="No video switch (A)"
                                    onClick={() => setPlayMode('pause')}
                                >
                                    <ImPause2 />
                                </button>
                                <span style={{ margin: '0 1rem' }} />
                            </>
                        )}
                        <button title="Next random video (S)" onClick={skipToNextVideo}>
                            <ImForward3 />
                            <span>NEXT</span>
                        </button>
                        <IgnoreButton
                            onIgnore={ignoreVideosFromCurrentChannel}
                            visible={videosToPlay[0] !== undefined}
                        />
                        <span style={{ margin: '0 1rem' }} />
                        <button
                            className={viewMode === 0 ? 'active' : ''}
                            title="About"
                            onClick={() => setViewMode({ value: 0 })}
                        >
                            <IoInformation />
                        </button>
                        <button
                            className={viewMode === 1 ? 'active' : ''}
                            title="Default view (Q)"
                            onClick={() => setViewMode({ value: 1 })}
                        >
                            1
                        </button>
                        <button
                            className={viewMode === 2 ? 'active' : ''}
                            title="Without history (W)"
                            onClick={() => setViewMode({ value: 2 })}
                        >
                            2
                        </button>
                        <button
                            className={viewMode === 3 ? 'active' : ''}
                            title="With hidden navbar (E)"
                            onClick={() => setViewMode({ value: 3 })}
                        >
                            3
                        </button>
                    </div>
                </div>
            </nav>
            <YouTubeEmbed
                videoIds={videosToPlay}
                ignoredVideos={ignoredVideos}
                onFaultyVideo={(faultyVideoId) => {
                    setQueue((q) => q.filter((videoId) => videoId !== faultyVideoId))
                }}
                onEnd={() => {
                    if (playMode === 'play' && !selectedHistoryVideo) {
                        skipToNextVideo()
                    }
                }}
                onPause={() => {
                    setVideoPaused(true)
                }}
                onPlay={(e) => {
                    setVideoPaused(false)

                    if (selectedHistoryVideo) {
                        return
                    }
                    const { video_id, title, author } = e.target.getVideoData()
                    setHistory((h) => {
                        if (h[0]?.id === video_id) {
                            return h
                        } else {
                            return [
                                {
                                    id: video_id,
                                    name: title,
                                    author,
                                },
                            ].concat(h.slice(0, 49))
                        }
                    })
                }}
            />
            {viewMode === 1 && (
                <div className="history">
                    {history.map((historyEntry, idx) => {
                        let className = 'entry'
                        if (historyEntry.id === videosToPlay[0]) {
                            className += ' active'
                        }

                        return (
                            <div
                                key={historyEntry.id + '_' + idx}
                                className={className}
                                onClick={() => {
                                    if (
                                        !selectedHistoryVideo &&
                                        historyEntry.id === incomingRandomVideo
                                    ) {
                                        return
                                    }
                                    setSelectedHistoryVideo(historyEntry.id)
                                }}
                            >
                                <h2>{historyEntry.name}</h2>
                                <h5>{historyEntry.author}</h5>
                            </div>
                        )
                    })}
                </div>
            )}
            {viewMode === 0 && (
                <div className="about">
                    <div className="content">
                        <p>
                            This website leeches off random YouTube video IDs, provided by astronaut.io
                        </p>
                        <p>
                            I was unsatisfied with how astronaut works, but noticed that it allows
                            to connect cross-origin and decided to make a better one
                        </p>
                        <ul>
                            <li>Don't miss on interesting findings with recent view history</li>
                            <li>Auto-skip is more reliable</li>
                            <li>Skip to next videos on demand</li>
                            <li>You're not deprived of all player options like volume</li>
                            <li>
                                No video background to distract you from watching, hide the history
                                and navbar if you wish
                            </li>
                            <li>Ignore channels you don't find interesting</li>
                        </ul>
                    </div>
                    <div className="footer">
                        <h4>Ignored channels:</h4>
                        <div className="ignored-channels">
                            {ignoredVideosArray.length === 0 && <span>None</span>}
                            {ignoredVideosArray.map((author) => (
                                <button
                                    key={author}
                                    onClick={() => {
                                        setIgnoredChannels((i) => {
                                            const copy = { ...i }
                                            delete copy[author]
                                            return copy
                                        })
                                    }}
                                >
                                    {author}
                                    <IoCloseSharp />
                                </button>
                            ))}
                        </div>
                        <button
                            className="clear-view-history-button"
                            onClick={() => {
                                if (confirm('You sure want to clear video history and queue?')) {
                                    setHistory([])
                                    setQueue([])
                                }
                            }}
                        >
                            Clear video history and queue
                        </button>
                        <p style={{ textAlign: 'right' }}>
                            <a href="https://suxin.space">suxin.space</a> |{' '}
                            <a href="https://github.com/suXinjke/cosmic.io">GitHub</a>
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<CosmicIOApp />)
