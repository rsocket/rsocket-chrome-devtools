import React, {MouseEventHandler} from 'react';
import Panel from 'react-flex-panel';
import FontAwesome from 'react-fontawesome';
import classNames from 'classnames';
import './App.scss';
import {ObjectInspector} from 'react-inspector';
import {Frame} from 'rsocket-types';
import {
  BufferEncoders,
  deserializeFrame,
  deserializeFrameWithLength,
  FLAGS,
  FRAME_TYPES,
  printFrame,
  Utf8Encoders
} from "rsocket-core";
import {Encoders} from "rsocket-core/RSocketEncoding";

function getRSocketType(type) {
  for (const [name, code] of Object.entries(FRAME_TYPES)) {
    if (code === type) {
      return name;
    }
  }
  return toHex(type);
}

function toHex(n) {
  return '0x' + n.toString(16);
}

function shortFrame(frame: Frame) {
  const name = getRSocketType(frame.type);
  const flags: string[] = [];
  for (const [name, flag] of Object.entries(FLAGS)) {
    if (frame.flags & flag) {
      flags.push(name);
    }
  }
  return `${name} [${flags.join(", ")}]`;
}

const padded = (num, d) => num.toFixed(0).padStart(d, '0');

const stringToBuffer = str => {
  const ui8 = new Uint8Array(str.length);
  for (let i = 0; i < str.length; ++i) {
    ui8[i] = str.charCodeAt(i);
  }
  return ui8;
};

const TimeStamp = ({time}) => {
  const h = time.getHours();
  const m = time.getMinutes();
  const s = time.getSeconds();
  const ms = time.getMilliseconds();
  return <span className="timestamp">{padded(h, 2)}:{padded(m, 2)}:{padded(s, 2)}.{padded(ms, 3)}</span>;
};

function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Buffer(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
}

const FrameEntry = ({frame, selected, onClick}: { frame: WsFrame, selected: boolean, onClick: MouseEventHandler }) => {
  const rsocketFrame = tryDeserializeFrame(frame.payload)
  const frameName = rsocketFrame
    ? <span className="name">{shortFrame(rsocketFrame)}</span>
    : <span className="name">{frame.text != null ? "Text Frame" : "Binary Frame"}</span>
  return (
    <li
      className={classNames("frame", "frame-" + frame.type, {"frame-selected": selected})}
      onClick={onClick}>
      <FontAwesome name={frame.type === "incoming" ? "arrow-circle-down" : "arrow-circle-up"}/>
      <TimeStamp time={frame.time}/>
      {frameName}
      <span className="length">{frame.length}</span>
    </li>
  );
};

interface RSocketFrameProps {
  frame: Frame,
  data: Uint8Array,
  className: string
}

class RSocketFrame extends React.Component<RSocketFrameProps, any> {
  private hexView: HTMLUListElement;
  private asciiView: HTMLUListElement;

  render() {
    const {frame, data, className, ...props} = this.props;
    let numDigits = 4;
    while (1 << (numDigits * 4) <= data.length) {
      numDigits += 1;
    }
    const lineNumbers = [], hexView = [], asciiView = [];
    const dot = ".".charCodeAt(0);
    for (let pos = 0; pos < data.length; pos += 16) {
      const row = [...(data as any).subarray(pos, pos + 16)];
      lineNumbers.push(<li key={pos}>{pos.toString(16).padStart(numDigits, '0')}:</li>);
      hexView.push(<li key={pos}>
        {row.map((byte, i) => <span key={i}>{byte.toString(16).padStart(2, '0')}</span>)}
        {row.length < 16 && [...Array(16 - row.length)].map((nil, i) => <span key={i}
                                                                              className="padding">{"  "}</span>)}
      </li>);
      asciiView.push(<li
        key={pos}>{String.fromCharCode(...row.map(byte => byte >= 32 && byte <= 126 ? byte : dot))}</li>);
    }
    let jsonData: any;
    try {
      let data = (frame as any).data;
      jsonData = data ? JSON.parse(data) : undefined;
    } catch (e) {
      jsonData = undefined;
    }
    let jsonMeta: any;
    try {
      let meta = (frame as any).metadata;
      jsonMeta = meta ? JSON.parse(meta) : undefined;
    } catch (e) {
      jsonMeta = undefined;
    }
    const dataField = jsonData
      ? <div>
        <hr/>
        Data<br/><ObjectInspector data={jsonData}/></div>
      : <div/>
    const jsonField = jsonMeta
      ? <div>
        <hr/>
        Metadata<br/><ObjectInspector data={jsonMeta}/></div>
      : <div/>
    return (
      <div>
        Frame<br/>
        {printFrame(frame)}
        {dataField}
        {jsonField}
        <hr/>
        <div className={classNames(className, "RSocketFrame")} {...props}>
          <ul className="line-numbers">
            {lineNumbers}
          </ul>
          <ul className="hex-view" ref={node => this.hexView = node}>
            {hexView}
          </ul>
          <ul className="ascii-view" ref={node => this.asciiView = node}>
            {asciiView}
          </ul>
        </div>
      </div>
    )
  }
}

class FrameList extends React.Component<any, any> {
  render() {
    const {frames, activeId, onSelect, onClear, onStart, onStop, ...props} = this.props;
    return (
      <Panel {...props} className="LeftPanel">
        <div className="list-controls">
          <FontAwesome className="list-button" name="ban" onClick={onClear} title="Clear"/>
          <FontAwesome className="list-button" name="play" onClick={onStart} title="Start"/>
          <FontAwesome className="list-button" name="stop" onClick={onStop} title="Stop"/>
        </div>
        <ul className="frame-list" onClick={() => onSelect(null)}>
          {frames.map(frame =>
            <FrameEntry key={frame.id}
                        frame={frame}
                        selected={frame.id === activeId}
                        onClick={e => {
                          onSelect(frame.id);
                          e.stopPropagation();
                        }}
            />)}
        </ul>
      </Panel>
    );
  }
}

const TextViewer = ({data}) => (
  <div className="TextViewer tab-pane">
    {data}
  </div>
);

// Could
let cachedEncoders: Encoders<any> = Utf8Encoders
let cachedLengthPrefixedFrames: boolean = false;

function tryDeserializeFrameWith(data: string, buffer: Buffer, lengthPrefixedFrames, encoders: Encoders<any>) {
  try {
    return lengthPrefixedFrames
      ? deserializeFrameWithLength(buffer, encoders)
      : deserializeFrame(buffer, encoders);
  } catch (e) {
    // console.error("failed to decode frame", e)
    return undefined;
  }
}

function tryDeserializeFrame(data: string): Frame | undefined {
  const buffer = base64ToArrayBuffer(data)
  let frame: Frame | undefined;
  // fast path
  frame = tryDeserializeFrameWith(data, buffer, cachedLengthPrefixedFrames, cachedEncoders);
  if (frame) {
    return frame;
  }
  // slow path
  let attempts: [Encoders<any>, boolean][] = [
    [Utf8Encoders, false],
    [Utf8Encoders, true],
    [BufferEncoders, false],
    [BufferEncoders, true],
  ];
  for (let [encoders, lengthPrefixedFrames] of attempts) {
    frame = tryDeserializeFrameWith(data, buffer, lengthPrefixedFrames, encoders);
    if (frame) {
      cachedEncoders = encoders;
      cachedLengthPrefixedFrames = lengthPrefixedFrames;
      return frame;
    }
  }
  return undefined;
}

const RSocketViewer = ({frame, data}) => {
  try {
    return (
      <div className="TextViewer tab-pane">
        <RSocketFrame className="tab-pane" frame={frame} data={base64ToArrayBuffer(data)}/>
      </div>
    )
  } catch (e) {
    console.error("Unable to decode frame", e);
    return (
      <div className="TextViewer tab-pane">
        Unable to decode frame
      </div>
    )
  }
};


class FrameView extends React.Component<{ wsFrame: WsFrame }, { panel?: string }> {
  constructor(props: { wsFrame: WsFrame }) {
    super(props);
    this.state = {panel: null};
  }

  render() {
    const {wsFrame} = this.props;
    const rsocketFrame = tryDeserializeFrame(wsFrame.payload)
    const panel = rsocketFrame
      ? <RSocketViewer frame={rsocketFrame} data={wsFrame.payload}/>
      : wsFrame.text
          ? <TextViewer data={wsFrame.text}/>
          : <TextViewer data={wsFrame.binary}/>;
    return (
      <div className="FrameView">
        {panel}
      </div>
    );
  }
}

interface WsFrame {
  id: number,
  type: 'incoming' | 'outgoing',
  time: Date,
  length: number,
  text?: string,
  binary?: Uint8Array,
  payload: string,
}

/**
 * WebSocket message data. This represents an entire WebSocket message, not just a fragmented frame as the name suggests.
 */
interface WebSocketFrame {
  /** WebSocket message opcode. */
  opcode: number,
  /** WebSocket message mask. */
  mask: boolean,
  /**
   * WebSocket message payload data. If the opcode is 1, this is a text message and payloadData is a UTF-8 string. If
   * the opcode isn't 1, then payloadData is a base64 encoded string representing binary data.
   */
  payloadData: string,
}

interface AppState {
  frames: WsFrame[];
  capturing: boolean;
  activeId: null
}

export default class App extends React.Component<any, AppState> {
  _uniqueId = 0;
  issueTime = null;
  issueWallTime = null;

  state: AppState = {
    frames: [],
    activeId: null,
    capturing: true,
  }

  getTime(timestamp): Date {
    if (this.issueTime == null) {
      this.issueTime = timestamp;
      this.issueWallTime = new Date().getTime();
    }
    return new Date((timestamp - this.issueTime) * 1000 + this.issueWallTime);
  }

  constructor(props) {
    super(props);

    props.handlers["Network.webSocketFrameReceived"] = this.frameReceived.bind(this);
    props.handlers["Network.webSocketFrameSent"] = this.frameSent.bind(this);
  }

  render() {
    const {frames, activeId} = this.state;
    const active = frames.find(f => f.id === activeId);
    return (
      <Panel cols className="App">
        <FrameList
          size={300}
          minSize={180}
          resizable
          frames={frames}
          activeId={activeId}
          onClear={this.clearFrames}
          onSelect={this.selectFrame}
          onStart={this.startCapture}
          onStop={this.stopCapture}
        />
        <Panel minSize={100} className="PanelView">
          {active != null ? <FrameView wsFrame={active}/> :
            <span className="message">Select a frame to view its contents</span>}
        </Panel>
      </Panel>
    );
  }

  selectFrame = id => {
    this.setState({activeId: id});
  };

  clearFrames = () => {
    this.setState({frames: []});
  };

  startCapture = () => {
    this.setState({capturing: true});
  }

  stopCapture = () => {
    this.setState({capturing: false});
  }

  addFrame(type, timestamp, response: WebSocketFrame) {
    if (response.opcode === 1 || response.opcode === 2) {
      const frame: WsFrame = {
        type,
        id: ++this._uniqueId,
        time: this.getTime(timestamp),
        length: response.payloadData.length,
        payload: response.payloadData,
      };
      if (response.opcode === 1) {
        frame.text = response.payloadData;
      } else {
        frame.binary = stringToBuffer(response.payloadData);
      }
      this.setState(({frames}) => ({frames: [...frames, frame]}));
    }
  }

  frameReceived({timestamp, response}: { timestamp: any, response: WebSocketFrame }) {
    if (this.state.capturing === true) {
      this.addFrame("incoming", timestamp, response);
    }
  }

  frameSent({timestamp, response}: { timestamp: any, response: WebSocketFrame }) {
    if (this.state.capturing === true) {
      this.addFrame("outgoing", timestamp, response);
    }
  }
}
