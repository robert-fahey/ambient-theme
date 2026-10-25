// Streams MacBook ambient light sensor readings as NDJSON on stdout.
// Uses private IOKit HID symbols resolved at runtime (no entitlements needed).
import Foundation

var interval: UInt32 = 1000
if let i = CommandLine.arguments.firstIndex(of: "--interval"), i + 1 < CommandLine.arguments.count,
   let v = UInt32(CommandLine.arguments[i + 1]) {
  interval = max(50, v)
}

setvbuf(stdout, nil, _IOLBF, 0)

func emit(_ s: String) { print(s); fflush(stdout) }

guard let h = dlopen("/System/Library/Frameworks/IOKit.framework/IOKit", RTLD_NOW) else {
  emit("{\"error\":\"no-iokit\"}"); exit(2)
}

typealias Create = @convention(c) (CFAllocator?) -> Unmanaged<AnyObject>?
typealias SetMatch = @convention(c) (AnyObject, CFDictionary) -> Void
typealias Copy = @convention(c) (AnyObject) -> Unmanaged<CFArray>?
typealias CopyEv = @convention(c) (AnyObject, Int64, Int32, Int64) -> Unmanaged<AnyObject>?
typealias GetF = @convention(c) (AnyObject, Int32) -> Double

func sym<T>(_ name: String) -> T? {
  guard let p = dlsym(h, name) else { return nil }
  return unsafeBitCast(p, to: T.self)
}

guard let create: Create = sym("IOHIDEventSystemClientCreate"),
      let setMatching: SetMatch = sym("IOHIDEventSystemClientSetMatching"),
      let copyServices: Copy = sym("IOHIDEventSystemClientCopyServices"),
      let copyEvent: CopyEv = sym("IOHIDServiceClientCopyEvent"),
      let getFloat: GetF = sym("IOHIDEventGetFloatValue"),
      let client = create(kCFAllocatorDefault)?.takeRetainedValue()
else { emit("{\"error\":\"no-symbols\"}"); exit(2) }

let kAmbientLightEvent: Int64 = 12
let kAmbientLightLevelField: Int32 = 12 << 16

setMatching(client, ["PrimaryUsagePage": 0xff00, "PrimaryUsage": 4] as CFDictionary)
let services = (copyServices(client)?.takeRetainedValue() as? [AnyObject]) ?? []
guard !services.isEmpty else { emit("{\"error\":\"no-sensor\"}"); exit(2) }

// Exit when the parent closes our stdin so we never outlive VS Code.
DispatchQueue.global().async {
  while let _ = readLine() {}
  exit(0)
}

while true {
  var lux: Double? = nil
  for svc in services {
    if let ev = copyEvent(svc, kAmbientLightEvent, 0, 0)?.takeRetainedValue() {
      lux = getFloat(ev, kAmbientLightLevelField)
      break
    }
  }
  if let lux = lux {
    emit("{\"lux\":\(lux)}")
  } else {
    emit("{\"error\":\"no-event\"}")
  }
  usleep(interval * 1000)
}
