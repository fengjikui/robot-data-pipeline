<div align="center">
  <h1 align="center">Cyclone DDS and Unitree SDK</h1>
</div>

> Translate from [Chinese Version](https://github.com/unitreerobotics/xr_teleoperate/wiki/CycloneDDS-and-UnitreeSDK-(zh%E2%80%90cn))


## 0. **Robots Need Great Communication**

Modern robots aren’t single-chip toys; they’re complex systems with **multiple processors, sensors, and actuators**. Perception runs here, decision-making there, execution elsewhere—and data must flow between them **reliably, with low latency, and under control**.

In robotics we often find: raw Sockets are too primitive, HTTP is too slow, MQTT is too lightweight. Is there a **ready-made, industry-proven** option that satisfies our needs for **real-time behavior, reliability, and cross-platform interoperability**?

Enter **DDS (Data Distribution Service)**. DDS wasn’t invented specifically for robots. Proposed by the OMG in the 1990s, it was first used in flight control, naval combat systems, and industrial automation—distributed systems with extreme real-time and reliability requirements. Precisely because DDS has been proven in such harsh scenarios, it naturally fits multi-sensor, multi-actuator communication in robotics.

## 1. What Are DDS and CycloneDDS?

**Data Distribution Service (DDS)** is a data-centric middleware standard for distributed systems. It defines the APIs and semantics for publishing, subscribing, filtering, transporting, and managing data. DDS isn’t merely a **publish–subscribe** mechanism; think of it more as a **Global Data Space**: every node can write to and read from a shared “whiteboard” without caring which machine the other end runs on or which language it uses.

In short, DDS is a communication standard that uses **Domain (domain ID)**, **Topic (topic name)**, **Data Type (IDL definition)**, and **QoS configuration** to uniquely determine **what data** is communicated and **how** it’s transported, thereby establishing publish–subscribe channels that meet application needs across distributed nodes. In plainer terms:

- **Domain (Domain ID)** → decides “which meeting room we’re in”

  Imagine different robots talking in different rooms: one discussing Unitree G1, another Unitree H1_2; one about real hardware deployment, another about simulation. This avoids interference between apps even if they use the same topic names.

  The Domain ID is the room number. Even on the same Layer-2 broadcast domain, different domains keep traffic from mixing.

- **Topic (topic name)** → decides “what we’re talking about”

  Is it sensor data, control commands, or camera images?

  Only those who recognize the same Topic will understand and receive that data.

- **Data type (IDL definition)** → decides “the format and structure of the info”

  Once the topic is set, we still need a common language: string? array? or a struct with multiple fields?

  To enable cross-language (C, C++, Python, …) comms, DDS uses **IDL (Interface Definition Language)** to define data structures. IDL is like a “multi-language dictionary”: given field names and types, code generators produce the corresponding classes/structs for each language.

- **QoS configuration** → decides “the rules and constraints of the conversation”

  Finally, how do we talk: fire-and-forget, strict acknowledgement, or hard real-time with zero loss?

  These are QoS (Quality of Service) policies, letting comms handle both “high-rate sensor streams” and “critical control commands that must be delivered reliably”.

<div align="center">
  <a href="https://www.dds-foundation.org/what-is-dds-3/" target="_blank">
    <img src="https://github.com/user-attachments/assets/7636dcc0-a431-4710-94c6-a266e05e02e3" alt="dds" width="50%">
  </a>
</div>


Everything above describes the **conceptual DDS standard**, while **Eclipse Cyclone DDS** is a high-performance, robust **implementation** of the [OMG](https://www.omg.org/)-compliant DDS standard. Eclipse Cyclone DDS is one of the officially supported RMWs for ROS 2. Unitree’s official SDKs—[unitree_sdk2](https://github.com/unitreerobotics/unitree_sdk2) and [unitree_sdk2_python](https://github.com/unitreerobotics/unitree_sdk2_python)—also adopt it as their transport. Because they use the same middleware, the Unitree SDKs can communicate with ROS 2 with some adjustments (see [ros2_communication_routine](https://support.unitree.com/home/zh/G1_developer/ros2_communication_routine)).

## 2. How the DDS Libraries Relate

We’ve established that DDS is a standard and Eclipse Cyclone DDS is one implementation. But what libraries do you actually need in a robot, and how do they relate? This matters because you’ll encounter interfaces in C++, Python, etc. If you don’t sort them out, it’s easy to get confused.

- [cyclonedds](https://github.com/eclipse-cyclonedds/cyclonedds)

  The **core C library** of Eclipse Cyclone DDS. It implements the OMG DDS standard and exposes a C API. It also ships **idlc (the IDL compiler)** to generate code from `.idl` files, plus **performance tools** to measure latency, throughput, and more.

- [cyclonedds-cxx](https://github.com/eclipse-cyclonedds/cyclonedds-cxx)

  The **C++ binding** for Eclipse Cyclone DDS. Built on the core C lib, it provides a modern C++ interface (RAII, strong typing, etc.) so you can use DDS in idiomatic C++.

- [cyclonedds-python](https://github.com/eclipse-cyclonedds/cyclonedds-python)

  The **Python binding** for Eclipse Cyclone DDS. A Pythonic API to access DDS, great for rapid prototyping, testing, and scripted robot control.

- [unitree_sdk2](https://github.com/unitreerobotics/unitree_sdk2)

  Unitree’s official **C++** robot comms/control library. Its `thirdparty` directory already includes the Cyclone DDS **core C lib**, the **C++ binding**, and headers (v0.10.2), as well as IDL type headers needed for Unitree robots. So you don’t need to download Cyclone DDS core/C++ separately.

- [unitree_sdk2_python](https://github.com/unitreerobotics/unitree_sdk2_python)

  Unitree’s official **Python** robot comms/control library. It imports `cyclonedds` in code via `from cyclonedds.xxx import xxx`. After cloning, you must install that dependency. Two methods:

  - `pip install cyclonedds==0.10.2` to match Unitree’s default version;
  - or build from source as in §3.3 “Python Binding”.

- [unitree_dds_wrapper](https://github.com/Agnel-Wang/unitree_dds_wrapper)

  A personal **Python** robot comms/control library for Unitree. Functionally similar to unitree_sdk2_python.

- Even if you don’t use unitree_sdk2_python and only use the C++ unitree_sdk2, you’ll still need the Python binding (installed as in §3.3) to run handy CLI tools such as `cyclonedds ps` or `cyclonedds subscribe topic_name`.

## 3. Installation

### 3.1 Core C Library

[cyclonedds](https://github.com/eclipse-cyclonedds/cyclonedds)

```bash
cd ~
mkdir testdds & cd testdds
git clone https://github.com/eclipse-cyclonedds/cyclonedds.git
# To avoid C++/Python API compatibility issues, keep core C and binding versions aligned.
# For example, switch to Unitree’s 0.10.2 version:
cd cyclonedds
git checkout tags/0.10.2
# Create build and install dirs
mkdir build install && cd build

# CMAKE_INSTALL_PREFIX chooses the install path; here we install into our local 'install' dir.
cmake .. -DCMAKE_INSTALL_PREFIX=../install
# Alternatively, install system-wide:
cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local/

# If installing system-wide, you may need sudo for write permissions:
cmake --build . --target install

# Inspect install layout
cd ~/testdds/cyclonedds/install
tree -L 2
├── bin
│   ├── ddsperf      
│   └── idlc          # IDL compiler: compiles `*.idl` to target-language sources (C by default, C++ if the binding is present), linking to lib/libddsc.so and lib/libcycloneddsidl.so.0
├── include
│   ├── dds           # Runtime/platform abstraction (ddsrt) and internal impl (ddsi) headers. Most apps don’t include these directly, but they’re commonly installed.
│   ├── ddsc          # Public C API header dds.h; links against lib/libddsc.so
│   ├── idl           # IDL abstraction/tooling layer. Not needed directly by app code.
│   └── idlc          # Compiler interfaces/options. Not needed directly by app code.
├── lib
│   ├── cmake
│   ├── libcycloneddsidl.so -> libcycloneddsidl.so.0             # build-time
│   ├── libcycloneddsidl.so.0 -> libcycloneddsidl.so.0.10.2      # runtime, major versioned
│   ├── libcycloneddsidl.so.0.10.2                               # actual IDL lib
│   ├── libddsc.so -> libddsc.so.0
│   ├── libddsc.so.0 -> libddsc.so.0.10.2
│   ├── libddsc.so.0.10.2                                        # C runtime
│   ├── libdds_security_ac.so                                    # DDS Security plugins: AccessControl
│   ├── libdds_security_auth.so                                  # Authentication
│   ├── libdds_security_crypto.so                                # Cryptographic
│   └── pkgconfig
└── share
    └── doc           # docs
```

**Note**

> The `-DCMAKE_INSTALL_PREFIX` argument selects the installation directory. When you run `make install` or `cmake --build . --target install`, built files are installed there.

From the layout you can see `bin`, `include`, and `lib`. The main artifacts are `libddsc.so`, `libcycloneddsidlc.so`, `libcycloneddsidl.so`, etc.

### 3.2 C++ Binding

**[cyclonedds-cxx](https://github.com/eclipse-cyclonedds/cyclonedds-cxx)**

```bash
# C++ version
cd ~/testdds
git clone https://github.com/eclipse-cyclonedds/cyclonedds-cxx.git
cd cyclonedds-cxx
git checkout tags/0.10.2
mkdir build && cd build

# CMAKE_INSTALL_PREFIX: where to install. We install alongside the C core to help idlc find things.
# DCMAKE_PREFIX_PATH should point to the core C install.
cmake -DCMAKE_INSTALL_PREFIX="$HOME/testdds/cyclonedds/install" -DCMAKE_PREFIX_PATH="$HOME/testdds/cyclonedds/install" ..
# Or install system-wide. Assuming the C core is also system-installed:
cmake -DCMAKE_INSTALL_PREFIX=/usr/local -DCMAKE_PREFIX_PATH=/usr/local ..

# sudo may be needed for system paths:
cmake --build . --target install

# Installed files in the shared install dir:
cd ~/testdds/cyclonedds/install/
tree -L 2
# (omitting files from the original C core install for brevity)
.
├── include
│   ├── ddscxx     # C++ API headers (dds.hpp)
├── lib
│   ├── cmake
│   ├── libcycloneddsidlcxx.so -> libcycloneddsidlcxx.so.0
│   ├── libcycloneddsidlcxx.so.0 -> libcycloneddsidlcxx.so.0.10.2
│   ├── libcycloneddsidlcxx.so.0.10.2       # IDL compiler C++ backend
│   ├── libddscxx.so -> libddscxx.so.0
│   ├── libddscxx.so.0 -> libddscxx.so.0.10.2
│   ├── libddscxx.so.0.10.2                 # C++ runtime
└── share
    └── doc
```

**Note**

`-DCMAKE_PREFIX_PATH` adds one or more paths to CMake’s search paths for dependencies (libs, packages, etc.).

**Error explanation**

> If you install the C++ binding in a different location from the C core, then running `~/testdds/cyclonedds/install/bin/idlc -l cxx` may fail with:
>
> `Cannot load generator libcycloneddsidlcxx.so: libcycloneddsidlcxx.so: cannot open shared object file: No such file or directory idlc: cannot load generator cxx`
>
> Fix: add the binding’s lib directory to your loader path:
>
> `export LD_LIBRARY_PATH=~/testdds/cyclonedds-cxx/install/lib:$LD_LIBRARY_PATH`

### 3.3 Python Binding

**[cyclonedds-python](https://github.com/eclipse-cyclonedds/cyclonedds-python)**

```bash
# If using PyPI wheels, you usually don't need a local C core. For source installs,
# the Python binding needs the core C library. Point CYCLONEDDS_HOME to the C core install.
# This should match the DCMAKE_INSTALL_PREFIX used for the C++ binding.
# Consider adding this export to ~/.bashrc; otherwise a new terminal may not find the libs.
export CYCLONEDDS_HOME="$HOME/testdds/cyclonedds/install"
# If the core C library is system-installed:
export CYCLONEDDS_HOME="/usr/local/"

cd ~/testdds
# Install Python binding from source at Unitree’s default version:
pip install git+https://github.com/eclipse-cyclonedds/cyclonedds-python@0.10.2
# Or from PyPI at Unitree’s default version:
pip install cyclonedds==0.10.2
```

**Error explanation**

> ```bash
> $ pip install git+https://github.com/eclipse-cyclonedds/cyclonedds-python
> Collecting git+https://github.com/eclipse-cyclonedds/cyclonedds-python
> Cloning https://github.com/eclipse-cyclonedds/cyclonedds-python to /tmp/pip-req-build-qe39cinw
> Running command git clone --filter=blob:none --quiet https://github.com/eclipse-cyclonedds/cyclonedds-python /tmp/pip-req-build-qe39cinw
> Resolved https://github.com/eclipse-cyclonedds/cyclonedds-python to commit 82985936da79eab94d2e2db865b3d8cc2cf2ef31
> Installing build dependencies ... done
> Getting requirements to build wheel ... error
> error: subprocess-exited-with-error
> 
> × Getting requirements to build wheel did not run successfully.
> │ exit code: 1
> ╰─> [1 lines of output]
>    Could not locate cyclonedds. Try to set CYCLONEDDS_HOME or CMAKE_PREFIX_PATH
>    [end of output]
> 
> note: This error originates from a subprocess, and is likely not a problem with pip.
> error: subprocess-exited-with-error
> 
> × Getting requirements to build wheel did not run successfully.
> │ exit code: 1
> ╰─> See above for output.
> 
> note: This error originates from a subprocess, and is likely not a problem with pip.
> ```
>
> This indicates `CYCLONEDDS_HOME` isn’t set (or wasn’t set in the same shell during install). Re-export it and reinstall:
>
> `export CYCLONEDDS_HOME="<cyclonedds-install-location>"`

### 3.4 Command-Line Tools

The Python binding ships handy CLI tools; see: [The cyclonedds command line tool](https://cyclonedds.io/docs/cyclonedds-python/latest/tools.html). The C/C++ ecosystems currently don’t provide an equivalent `cyclonedds` CLI. Common subcommands:

|              Command              |                   Description                    |
| :-------------------------------: | :----------------------------------------------: |
|          `cyclonedds ls`          |         Show DDS entities and their QoS          |
|          `cyclonedds ps`          |    List applications/topics in the DDS system    |
| `cyclonedds subscribe topic_name` | Dynamically subscribe to a topic and stream data |

## 4. Network Configuration

We’ve clarified the library relationships and completed installation. That’s not enough: to make processes on different compute nodes actually “talk,” **network configuration** is just as critical. DDS relies on discovery and efficient transport; if the network isn’t set up right, nodes may never “hear” each other even when your API calls look fine. Before coding, understand how Cyclone DDS discovers peers and transports data.

### 4.1 Concepts

| Layer |    Name     |                   Role                   |    Key addressing    |            Examples             |
| :---: | :---------: | :--------------------------------------: | :------------------: | :-----------------------------: |
|   5   | Application |         Protocols & data formats         | Application protocol |         HTTP, DDS, MQTT         |
|   4   |  Transport  | End-to-end process comms; app separation |    Port (0–65535)    |  TCP 80 (HTTP), UDP 7400 (DDS)  |
|   3   |   Network   |    Cross-network addressing & routing    |    IP (IPv4/IPv6)    | 192.168.123.10 → 192.168.123.20 |
|   2   |  Data Link  |         Same L2 segment delivery         |     MAC (48-bit)     |        AA:BB:CC:DD:EE:FF        |
|   1   |  Physical   |         Transmit bits as signals         |        Medium        |       RJ45, Wi-Fi, fiber        |

#### 4.1.1 Automatic Discovery

To establish DDS communication across compute nodes, they must first discover each other. Otherwise it’s like two people in the same room unaware the other is speaking. DDS calls this **Discovery**. If discovery fails, no comms will be established.

Cyclone DDS discovery relies on **reachable UDP multicast**. In general, **only nodes in the same Layer-2 broadcast domain (often same VLAN)** can discover each other (unless the network is configured to forward multicast at L3, or you configure a `Discovery/Peers` list for **unicast discovery** across L3). Distinct L2 broadcast domains are **physically isolated** at the data link layer; without L3 forwarding and multicast routing, discovery won’t work.

Within the same L2 domain, different apps using the same domain may interfere. DDS provides **logical isolation** at the **application layer** via **Domain ID**: nodes discover & talk only if they share the same Domain ID (bounded by port/layer limits; using IDs in 0–231 is a safe choice). Think of it as a “channel”:

- **Same Domain ID** → same logical partition; can discover and exchange data.
- **Different Domain IDs** → fully isolated logical spaces, even on the same L2.

That lets you split multiple apps/robots into non-interfering groups without changing physical topology. A practical example:

> While debugging joint control, we once saw severe motor oscillation. The cause wasn’t the control algorithm, but the network environment.
>
> By default, Unitree SDK examples often use Domain ID `0`, e.g.:
>
> ```python
> # https://github.com/unitreerobotics/unitree_sdk2_python/blob/18b9ef8e57e69b73c5e9b301b8481fce16a44b9b/example/g1/low_level/g1_low_level_example.py#L195-L198
> if len(sys.argv)>1:
> ChannelFactoryInitialize(0, sys.argv[1])
> else:
> ChannelFactoryInitialize(0)
> ```
>
> Meanwhile, colleagues were running simulations in the same L2 domain; they also published `rt/lowcmd` in Domain `0`. Result: both the physical robot and the simulator published control commands to the same topic in Domain 0. The commands collided, causing the joints to fight each other. We moved all simulation DDS traffic to Domain `1`:
>
> ```python
> # https://github.com/unitreerobotics/unitree_sim_isaaclab/blob/06ad02461781577276b85d451895794bc89bef9e/dds/dds_master.py#L55
> ChannelFactoryInitialize(1)
> # https://github.com/unitreerobotics/xr_teleoperate/blob/a347067941e8be8381480287e249d021d0e2a141/teleop/robot_control/robot_arm.py#L84-L87
> if self.simulation_mode:
> ChannelFactoryInitialize(1)
> else:
> ChannelFactoryInitialize(0)
> ```

#### 4.1.2 Unicast Transport

After discovery, Cyclone DDS **prefers unicast for user data when possible** (you can enable multicast or `iceoryx` shared memory for intra-host as needed). This is why Cyclone DDS expects nodes to be in the **same IP subnet**:

- **Same L2 domain** ensures multicast packets for discovery can pass;
- **Same L3 subnet** ensures unicast packets after discovery can route point-to-point.

Discovery answers “I know you exist,” while unicast answers “I can deliver data to you.” Without both, DDS won’t truly work.

> - Layer 2 Broadcast Domain  
>   - A set of devices that can receive the same Layer 2 broadcast frame (such as an ARP request), usually determined by a switch VLAN. Broadcasts are not blocked by Layer 2 switches but are isolated by Layer 3 devices (routers). The meaning of being in the same Layer 2 broadcast domain is that devices can directly receive Layer 2 broadcast or multicast frames at the data link layer without passing through Layer 3 forwarding.

>
> - Layer 3 Subnet  
>   - A logical network defined by an IP address and subnet mask. Two hosts are considered in the same Layer 3 subnet if their network addresses (the result of IP address AND subnet mask) are the same.  
>
> - Example Comparison  
>   - 192.168.123.161/24 and 192.168.123.164/24 on the same VLAN  
>     They belong to the same Layer 2 broadcast domain, so Cyclone DDS multicast discovery messages can reach each other; at the same time their network addresses are the same (192.168.123.0/24), meaning they are in the same subnet. Unicast messages can be delivered directly without router forwarding. This is the ideal case where both discovery and communication work normally.  
>
>   - 192.168.123.161/24 and 192.168.1.10/24 on the same VLAN  
>     They are in the same Layer 2 broadcast domain, so Cyclone DDS multicast discovery messages can still reach each other and nodes can discover each other; but their IP addresses belong to different subnets, so unicast messages cannot be routed directly and must rely on a Layer 3 gateway, which DDS does not support by default. This results in being able to discover each other, but unicast communication fails.  
>
>   - 192.168.123.161/24 on VLAN10 and 192.168.123.164/24 on VLAN20  
>     Because of VLAN isolation, they are not in the same Layer 2 broadcast domain, so Cyclone DDS multicast discovery messages cannot reach each other and nodes cannot discover each other; even if the IP addresses are configured in the same subnet, unicast communication cannot be established. This is a case where neither discovery nor communication works.  


### 4.2 Unitree Robot Development

This explains the IP setup from the [Unitree G1 Docs – Quick Development](https://support.unitree.com/home/zh/G1_developer/quick_development):

> Connect your computer and the Unitree G1 switch to the same network. New users are advised to use a cable & adapter to connect to the G1 switch and set the NIC used for robot comms to the `192.168.123.x` subnet—`192.168.123.99` is recommended. Experienced users may adjust the network environment as they wish.
>
> Connect one end of the cable to the robot and the other to your PC, enable the USB Ethernet, then configure it. The robot’s onboard PC IP is `192.168.123.161`, so set your USB Ethernet to the same subnet, e.g. `192.168.123.222`.

The robot’s internal motion-control PC1 and dev PC2 are preset to `192.168.123.x/24`: `192.168.123.161/24` and `192.168.123.164/24`. To publish control messages or subscribe to state from PC1 (`192.168.123.161`) via Cyclone DDS, follow those docs. After configuring, your PC and the robot’s PC1/PC2 share the same L2 domain and L3 subnet, enabling DDS.

When tele-operating or debugging, if the robot won’t move, a common cause is **DDS comms not established**. For rapid checks, add comms health checks to confirm the network rather than blaming control logic.

```bash
# E.g., https://github.com/unitreerobotics/xr_teleoperate/blob/main/teleop/robot_control/robot_arm.py
# checks whether the PC is actually receiving the robot’s DDS topics:
while not self.lowstate_buffer.GetData():
    time.sleep(0.1)
    logger_mp.warning("[G1_29_ArmController] Waiting to subscribe dds...")
```

When initializing DDS channels, the Unitree SDK can explicitly select a NIC (`networkInterface` parameter). If a device has multiple NICs in different subnets, DDS will **discover and transport** only over the selected NIC’s subnet—ensuring comms happen on the intended network instead of leaking into unrelated subnets.

```c++
// E.g., in https://github.com/unitreerobotics/unitree_sdk2/blob/main/example/g1/high_level/g1_arm7_sdk_dds_example.cpp
// parameter 0 selects Domain ID 0; argv[1] passes the NIC name.
unitree::robot::ChannelFactory::Instance()->Init(0, argv[1]);
// Similarly, in https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/example/g1/low_level/g1_low_level_example.py
// 0 selects Domain ID 0; sys.argv[1] names the NIC.
ChannelFactoryInitialize(0, sys.argv[1])
```

## 5. DDS Usage Example

We’ve installed everything and validated DDS comms via `ping` and `cyclonedds ps`. Those steps ensure “the pipes are open.” Now to application-layer development:  
define message types in IDL and implement C++/Python publishers/subscribers. We’ll use a motor control command example to show a full DDS workflow. First, the **dev vs runtime** flow:

- **Development**: author **IDL files** describing data structures (your “protocol spec”). Then run the **IDL compiler (idlc)** to generate support code (C/C++/Python). Use the generated types and serializers directly in your app.
- **Runtime**: your app uses the generated code and links the **Cyclone DDS core**. Discovery, serialization, and transport are automatic—just read/write typed messages.

```bash
[Development]
+--------------------+          +---------------------------------------+          +------------------------------------------------+
| Write user IDL     |    +     | IDL compiler (idlc) examples          |  --->    |  Generated type support code                    |
| (user_type.idl)    |          | - (C) idlc user_type.idl              |          |  - (C)      user_type.c, user_type.h           |
+--------------------+          | - (C++) idlc -l cxx user_type.idl     |          |  - (C++)    user_type.cpp, user_type.hpp       |
                                | - (Python) idlc -l py user_type.idl   |          |  - (Python) _user_type.py                      |
                                +---------------------------------------+          +------------------------------------------------+

[Runtime]
+----------------------------+            +------------------------------+
| Your application           |            | Cyclone DDS core             |
| (app.c / app.cpp / app.py) |    <---    | - libddsc.so (C core)        |
|                            |            | - libddscxx.so (C++)         |
| - Set Domain ID            |            | - cyclonedds-python (Py API) |
| - Create Participant       |            +------------------------------+
| - Define Topic (bind IDL)  |
| - Create Pub/Writer        |
| - Create Sub/Reader        |
| - Call write() / read()    |
+-------------+--------------+

[Transport]
- Discovery: UDP multicast (same L2 domain)
- Data: UDP unicast (same IP subnet)
- Optional: shared memory for intra-host
```

### 5.0 Recap of Installs

From §3 defaults:

- C core (0.10.2): `$HOME/testdds/cyclonedds/install`
- C++ binding (0.10.2): `$HOME/testdds/cyclonedds/install`
- Python binding (0.10.2): `pip install git+https://github.com/eclipse-cyclonedds/cyclonedds-python@0.10.2`

### 5.1 Create a Workspace

```bash
mkdir -p ~/motor_demo/{idl,cpp,py}
cd ~/motor_demo
export CYCLONEDDS_HOME="$HOME/testdds/cyclonedds/install"
# Add lib path
export LD_LIBRARY_PATH=$HOME/testdds/cyclonedds/install/lib:$LD_LIBRARY_PATH
# (Single-host example; not needed here) Tip: for cross-host/multi-NIC, pin the NIC via CYCLONEDDS_URI
export CYCLONEDDS_URI='<CycloneDDS><Domain><General><Interfaces><NetworkInterface name="eth0"/></Interfaces></General></Domain></CycloneDDS>'
```

### 5.2 Write IDL

IDL is a **language-agnostic** spec for data structures and message formats. It’s a “communication blueprint,” not code. From IDL you generate support code (C/C++/Python) so programs in different languages agree on the same data layout.

See syntax and types on the [Cyclone DDS docs](https://cyclonedds.io/content/guides/supported-idl.html). Below we mirror Unitree’s motor types, defining a single motor command (**[`MotorCmd_`](https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/unitree_sdk2py/idl/unitree_go/msg/dds_/)**) and a fixed array (**[`MotorCmds_`](https://github.com/unitreerobotics/unitree_sdk2_python/blob/master/unitree_sdk2py/idl/unitree_go/msg/dds_/_MotorCmds_.py)**).

```bash
cd idl
# Create single motor command IDL
vim motor_cmd.idl 
# Paste:
# motor_cmd.idl  -- Unitree-like motor command types
# This IDL defines a single motor command.

module unitree_go {
  module msg {
    module dds_ {
      @final
      struct MotorCmd_ {
        octet mode;                 // uint8
        float q;                    // float32
        float dq;                   // float32
        float tau;                  // float32
        float kp;                   // float32
        float kd;                   // float32
        unsigned long reserve[3];   // uint32[3]
      };
    };
  };
};

# Create array type
vim motor_cmds.idl
# Paste:
# motor_cmds.idl  -- Unitree-like motor command types
# This IDL defines a bundle of 20 motor commands.
#include "motor_cmd.idl"

module unitree_go {
  module msg {
    module dds_ {
      @final
      struct MotorCmds_ {
        MotorCmd_ motor_cmd[20];    // array of 20 MotorCmd_
      };
    };
  };
};

# Check
~/motor_demo/idl$ ls
motor_cmd.idl  motor_cmds.idl
```

### 5.3 Generate Type Support Code

IDL files are just definitions; apps need **type support** generated by **`idlc`**:

```bash
# Basic usage
idlc -l <language> <idl-file>

# <language>:
#   c    → C support (.c + .h)
#   cxx  → C++ support (.cpp + .hpp)
#   py   → Python package (.py)
```

#### 5.3.1 C++ Types

```bash
cd ~/motor_demo/cpp
~/testdds/cyclonedds/install/bin/idlc -l cxx ../idl/motor_cmd.idl
~/testdds/cyclonedds/install/bin/idlc -l cxx ../idl/motor_cmds.idl
# Generated:
ls
motor_cmd.cpp  motor_cmd.hpp  motor_cmds.cpp  motor_cmds.hpp
```

**Notes**:

- `.hpp`: C++ class declarations (data structure definitions). Include `motor_cmd.hpp` to use `MotorCmd_`.
- `.cpp`: serialization, etc. Compile & link alongside your app.

#### 5.3.2 Python Types

```bash
cd ~/motor_demo/py
~/testdds/cyclonedds/install/bin/idlc -l py ../idl/motor_cmd.idl
~/testdds/cyclonedds/install/bin/idlc -l py ../idl/motor_cmds.idl
# Resulting package:
~/motor_demo/py$ tree -L 4
.
└── unitree_go
    ├── __init__.py
    └── msg
        ├── dds_
        │   ├── __init__.py
        │   ├── _motor_cmd.py
        │   └── _motor_cmds.py
        └── __init__.py
```

**Notes**:

- For Python, you get a standard package structure.
- Use with `from unitree_go.msg.dds_ import MotorCmd_`.

### 5.4 Example Apps

We’ll implement **Publisher** and **Subscriber** in both **C++** and **Python**. Typical steps:

1. Create a **DomainParticipant** (matching Domain ID).
2. Define a **Topic** (bound to our IDL type).
3. Create **DataWriter/DataReader**.
4. Publisher calls `write()`, subscriber calls `take()`.

#### 5.4.1 C++ Types

Publisher (`~/motor_demo/cpp/motor_pub.cpp`):

```cpp
// motor_pub.cpp  -- CycloneDDS isocpp2 accessor style publisher
#include <chrono>
#include <thread>
#include <cstdint>
#include <dds/dds.hpp>

// Generated headers (from idlc -l cxx)
#include "motor_cmd.hpp"
#include "motor_cmds.hpp"

using namespace dds::domain;
using namespace dds::topic;
using namespace dds::pub;

int main(int, char**)
{
  // Use the same Domain ID across all participants
  const int domain_id = 0;

  // 1) Create participant and publisher
  dds::domain::DomainParticipant dp(domain_id);
  dds::pub::Publisher pub(dp);

  // 2) Type aliases (match your generated namespaces and types)
  using Cmd  = unitree_go::msg::dds_::MotorCmd_;
  using Cmds = unitree_go::msg::dds_::MotorCmds_;

  // 3) Create topic and writer
  dds::topic::Topic<Cmds> topic(dp, "rt/motor_cmds");
  dds::pub::DataWriter<Cmds> writer(pub, topic);

  std::cout << "waiting discovery..." << std::endl;
  std::this_thread::sleep_for(std::chrono::seconds(2));
  std::cout << "start writing." << std::endl;

  // 4) Prepare one message: fill the fixed-size array of 20 MotorCmd_
  Cmds out{};
  auto& arr = out.motor_cmd();  // array-like reference
  for (std::size_t i = 0; i < arr.size(); ++i) {
    Cmd c{};
    // Accessor-style setters:
    c.mode(static_cast<std::uint8_t>(i == 0 ? 0x01 : 0x00)); // enable only motor 0
    c.q(0.5f);
    c.dq(0.0f);
    c.tau(0.0f);
    c.kp(20.0f);
    c.kd(2.0f);
    // reserve is a fixed-size array
    auto& r = c.reserve();
    r[0] = r[1] = r[2] = 0u;

    arr[i] = c;
  }

  // 5) Publish periodically
  std::cout<<"pub start."<<std::endl;
  for (int n = 0; n < 3; ++n) {
    writer.write(out);
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  std::this_thread::sleep_for(std::chrono::seconds(1));
  std::cout<<"pub end."<<std::endl;
  return 0;
}
```

Subscriber (`~/motor_demo/cpp/motor_sub.cpp`):

```cpp
// motor_sub.cpp  -- CycloneDDS isocpp2 accessor style subscriber
#include <iostream>
#include <cstdint>
#include <dds/dds.hpp>

// Generated headers (from idlc -l cxx)
#include "motor_cmd.hpp"
#include "motor_cmds.hpp"

using namespace dds::domain;
using namespace dds::topic;
using namespace dds::sub;

int main(int, char**)
{
  const int domain_id = 0;

  // 1) Create participant and subscriber
  dds::domain::DomainParticipant dp(domain_id);
  dds::sub::Subscriber sub(dp);

  using Cmds = unitree_go::msg::dds_::MotorCmds_;

  // 2) Create topic and reader
  dds::topic::Topic<Cmds> topic(dp, "rt/motor_cmds");
  dds::sub::DataReader<Cmds> reader(sub, topic);

  // 3) Poll and take samples (non-blocking loop for simplicity)
  std::cout<<"sub start."<<std::endl;
  while (true) {
    auto samples = reader.take();
    for (auto const& s : samples) {
      if (!s.info().valid()) continue;

      const auto& msg = s.data();
      int idx = 0;
      for (auto const& motor : msg.motor_cmd()) {
        std::cout << "[C++] motor " << idx++ << ":"
                  << " mode=" << static_cast<int>(motor.mode())
                  << " q="    << motor.q()
                  << " dq="   << motor.dq()
                  << " tau="  << motor.tau()
                  << " kp="   << motor.kp()
                  << " kd="   << motor.kd()
                  << " reserve=[" << motor.reserve()[0]
                                  << "," << motor.reserve()[1]
                                  << "," << motor.reserve()[2] << "]"
                  << std::endl;
      }
      std::cout << std::string(50, '-') << std::endl;
    }
  }

  return 0;
}
```

#### 5.4.1 Python Types

Publisher (`~/motor_demo/py/motor_pub.py`):

```python
# motor_pub.py
# -*- coding: utf-8 -*-
import time
from cyclonedds.domain import DomainParticipant
from cyclonedds.topic import Topic
from cyclonedds.pub import DataWriter

# Generated types (idlc -l py)
from unitree_go.msg.dds_._motor_cmd import MotorCmd_
from unitree_go.msg.dds_._motor_cmds import MotorCmds_

def main():
    domain_id = 0

    # 1) Create participant, topic, and writer
    dp = DomainParticipant(domain_id)
    tp = Topic(dp, "rt/motor_cmds", MotorCmds_)
    dw = DataWriter(dp, tp)

    print("waiting discovery...")
    time.sleep(2.0)
    print("start publishing.")
	
    # 2) Prepare one MotorCmds message with 20 MotorCmd_ elements
    print("pub start.")
    cmds = MotorCmds_(
        motor_cmd=[
            MotorCmd_(
                mode=0x01, q=0.5, dq=0.0, tau=0.0,
                kp=20.0, kd=2.0, reserve=[0, 0, 0]
            )
        ] + [
            MotorCmd_(
                mode=0x00, q=0.0, dq=0.0, tau=0.0,
                kp=0.0, kd=0.0, reserve=[0, 0, 0]
            )
            for _ in range(19)
        ]
    )

    # 3) Publish the message periodically (3 times)
    for _ in range(3):
        dw.write(cmds)
        time.sleep(0.01)
    print("pub end.")

if __name__ == "__main__":
    main()
```

Subscriber (`~/motor_demo/py/motor_sub.py`):

```python
# motor_sub.py
# -*- coding: utf-8 -*-
from cyclonedds.domain import DomainParticipant
from cyclonedds.topic import Topic
from cyclonedds.sub import DataReader

# Generated type
from unitree_go.msg.dds_._motor_cmds import MotorCmds_

def main():
    domain_id = 0

    # 1) Create participant, topic, and reader
    dp = DomainParticipant(domain_id)
    tp = Topic(dp, "rt/motor_cmds", MotorCmds_)
    dr = DataReader(dp, tp)

    print("sub start.")

    # 2) Continuously take samples
    while True:
        for sample in dr.take():   # sample is already a MotorCmds_ instance
            info = getattr(sample, "sample_info", None)
            if info is not None and not info.valid_data:
                continue
            msg = getattr(sample, "data", sample)
            # 3) Iterate over 20 MotorCmd_ elements
            for i, motor in enumerate(msg.motor_cmd):
                print(f"[Py ] motor {i}: mode={int(motor.mode)} "
                      f"q={motor.q:.3f} dq={motor.dq:.3f} tau={motor.tau:.3f} "
                      f"kp={motor.kp:.3f} kd={motor.kd:.3f}")
            print("-" * 50)

if __name__ == "__main__":
    main()
```

### 5.5 Build & Run

#### 5.5.1 Build

C++ apps via CMake; ensure Cyclone DDS include/lib paths are correct.

`~/motor_demo/cpp/CMakeLists.txt`:

```cmake
cmake_minimum_required(VERSION 3.16)
project(motor_demo LANGUAGES CXX)

find_package(CycloneDDS-CXX REQUIRED)
find_package(CycloneDDS REQUIRED)

add_library(motor_types SHARED
  motor_cmd.cpp
  motor_cmds.cpp
)
target_include_directories(motor_types PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(motor_types PUBLIC CycloneDDS-CXX::ddscxx CycloneDDS::ddsc)

# Executables
add_executable(motor_pub motor_pub.cpp)
add_executable(motor_sub motor_sub.cpp)

target_link_libraries(motor_pub PRIVATE motor_types)
target_link_libraries(motor_sub PRIVATE motor_types)

set_property(TARGET motor_pub motor_sub PROPERTY CXX_STANDARD 11)
```

Build:

```bash
cd ~/motor_demo/cpp
mkdir build && cd build
# Env so the linker finds libs
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$HOME/testdds/cyclonedds/install/lib
export CYCLONEDDS_HOME="$HOME/testdds/cyclonedds/install"
# Configure & build
cmake -DCMAKE_PREFIX_PATH="$CYCLONEDDS_HOME" ..
cmake --build . -j6
```

#### 5.5.2 Run

Use separate terminals:

- **T1** & **T2**: run `motor_sub` (C++) and `motor_sub.py` (Python).
- **T3** & **T4**: run `motor_pub` (C++) and `motor_pub.py` (Python).

Verify cross-language, cross-process communications:

```bash
# terminal 1
cd ~/motor_demo/cpp/build
./motor_sub
# terminal 2
cd ~/motor_demo/py
python motor_sub.py
# terminal 3
cd ~/motor_demo/cpp/build
./motor_pub
# terminal 4
cd ~/motor_demo/py
python motor_pub.py
```

### 5.6 CLI Analysis

#### 5.6.1 Analysis

```bash
silencht@unitree:~/motor_demo$ ps -ef | grep motor
# PID 102724: ./motor_sub (C++ subscriber)
# PID 102756: python motor_sub.py (Python subscriber)
# PID 103474: python motor_pub.py (Python publisher)
silencht   102724   37555 99 00:00 pts/2    00:04:26 ./motor_sub
silencht   102756  102734 99 00:01 pts/3    00:04:15 python motor_sub.py
silencht   103474  102775 10 00:05 pts/4    00:00:00 python motor_sub.py

$ ip addr
# Wired NIC enp3s0 has IPv4 10.0.7.70/22 and is UP.
# Cyclone DDS will use this NIC and multicast (239.255.0.1:7400) for discovery.
2: enp3s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether d8:bb:c1:xx:xx:xx brd ff:ff:ff:ff:ff:ff
    inet 10.0.7.70/22 brd 10.0.7.255 scope global dynamic noprefixroute enp3s0
       valid_lft 28451sec preferred_lft 28451sec
    inet6 fe80::507b:77cf:0000:fdb0/64 scope link noprefixroute 
       valid_lft forever preferred_lft forever

$ cyclonedds ps
# Shows Participants and their Topics in the current domain:
#   PID 102724 (motor_sub): subscribes rt/motor_cmds
#   PID 102756 (python):    subscribes rt/motor_cmds
#   PID 103474 (python):    publishes rt/motor_cmds
┏━━━━━━━━━┳━━━━━━━━━━━━━┳━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ Host    ┃ Application ┃ Pid    ┃ Participants                         ┃ Topics        ┃
┡━━━━━━━━━╇━━━━━━━━━━━━━╇━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ unitree │ motor_sub   │ 102724 │ 0110e7aa-0c4d-122f-e01a-a3b0000001c1 │ rt/motor_cmds │
│ unitree │ python      │ 102756 │ 0110f91d-e442-5e23-e045-6e0b000001c1 │ rt/motor_cmds │
│ unitree │ python      │ 103474 │ 01108509-f0de-31a8-e4b6-9628000001c1 │ rt/motor_cmds │
└─────────┴─────────────┴────────┴──────────────────────────────────────┴───────────────┘

$ cyclonedds ls
# Detailed Participant view with QoS, network props, process name, and topic I/O.
# (1) C++ subscriber (PID 102724)
#   Topic: rt/motor_cmds
#   Typename: unitree_go::msg::dds_::MotorCmds_
#   Role: Subscriptions
#   QoS: Reliability.BestEffort (fast, may drop samples)
# XTypes Type ID is a structural fingerprint; if it doesn’t match, no match is made even if topic names match.
╭────────────────────────────────────────────── Participant 0110e7aa-0c4d-122f-e01a-a3b0000001c1 ──────────────────────────────────────────────╮
│                                                                                                                                              │
│ ╭──────────────────────────────────────────  QoS ──────────────────────────────────────────╮                                                 │
│ │ Liveliness.Automatic(lease_duration='10 seconds')                                        │                                                 │
│ │ Property(key='__Hostname', value='unitree')                                              │                                                 │
│ │ Property(key='__NetworkAddresses', value='udp/239.255.0.1:7400@2,udp/10.0.7.70:44226@2') │                                                 │
│ │ Property(key='__Pid', value='102724')                                                    │                                                 │
│ │ Property(key='__ProcessName', value='motor_sub')                                         │                                                 │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────╯                                                 │
│                                                                                                                                              │
│ ╭───────────────────────────────────────────────────────────── rt/motor_cmds ──────────────────────────────────────────────────────────────╮ │
│ │ ╭───────────────────────────────────────────────────────────── Common QoS ─────────────────────────────────────────────────────────────╮ │ │
│ │ │ DataRepresentation(use_cdrv0_representation=True, use_xcdrv2_representation=True)                                                    │ │ │
│ │ │ Deadline(deadline='infinity')                                                                                                        │ │ │
│ │ │ DestinationOrder.ByReceptionTimestamp                                                                                                │ │ │
│ │ │ Durability.Volatile                                                                                                                  │ │ │
│ │ │ DurabilityService(cleanup_delay=0, history=History.KeepLast(depth=1), max_samples=-1, max_instances=-1, max_samples_per_instance=-1) │ │ │
│ │ │ History.KeepLast(depth=1)                                                                                                            │ │ │
│ │ │ IgnoreLocal.Nothing                                                                                                                  │ │ │
│ │ │ LatencyBudget(budget='zero')                                                                                                         │ │ │
│ │ │ Lifespan(lifespan='infinity')                                                                                                        │ │ │
│ │ │ Liveliness.Automatic(lease_duration='infinity')                                                                                      │ │ │
│ │ │ Ownership.Shared                                                                                                                     │ │ │
│ │ │ PresentationAccessScope.Instance(coherent_access=False, ordered_access=False)                                                        │ │ │
│ │ │ ReaderDataLifecycle(autopurge_nowriter_samples_delay='infinity', autopurge_disposed_samples_delay='infinity')                        │ │ │
│ │ │ Reliability.BestEffort                                                                                                               │ │ │
│ │ │ ResourceLimits(max_samples=-1, max_instances=-1, max_samples_per_instance=-1)                                                        │ │ │
│ │ │ TimeBasedFilter(filter_time='zero')                                                                                                  │ │ │
│ │ │ TransportPriority(priority=0)                                                                                                        │ │ │
│ │ │ TypeConsistency.DisallowTypeCoercion(force_type_validation=False)                                                                    │ │ │
│ │ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │ │
│ │ ┌────────────────┬───────────────────────────────────────┐                                                                               │ │
│ │ │ Typename       │     unitree_go::msg::dds_::MotorCmds_ │                                                                               │ │
│ │ │ XTypes Type ID │ COMPLETE 3D6FC5EAA483DD0A5B41620CCB2A │                                                                               │ │
│ │ └────────────────┴───────────────────────────────────────┘                                                                               │ │
│ │              Subscriptions                                                                                                               │ │
│ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                                                                                 │ │
│ │ ┃ GUID                                 ┃                                                                                                 │ │
│ │ ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩                                                                                                 │ │
│ │ │ 0110e7aa-0c4d-122f-e01a-a3b000000204 │                                                                                                 │ │
│ │ └──────────────────────────────────────┘                                                                                                 │ │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
# (2) Python subscriber (PID 102756)
#   Subscribes rt/motor_cmds with BestEffort; TypeConsistency.AllowTypeCoercion looser checks.
╭────────────────────────────────── Participant 0110f91d-e442-5e23-e045-6e0b000001c1 ───────────────────────────────────╮
│                                                                                                                       │
│ ╭──────────────────────────────────────────  QoS ──────────────────────────────────────────╮                          │
│ │ Liveliness.Automatic(lease_duration='10 seconds')                                        │                          │
│ │ Property(key='__Hostname', value='unitree')                                              │                          │
│ │ Property(key='__NetworkAddresses', value='udp/239.255.0.1:7400@2,udp/10.0.7.70:58533@2') │                          │
│ │ Property(key='__Pid', value='102756')                                                    │                          │
│ │ Property(key='__ProcessName', value='python')                                            │                          │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────╯                          │
│                                                                                                                       │
│ ╭────────────────────────────────────────────────── rt/motor_cmds ──────────────────────────────────────────────────╮ │
│ │ ╭───────────────────────────────────────────────── Common QoS ──────────────────────────────────────────────────╮ │ │
│ │ │ DataRepresentation(use_cdrv0_representation=True, use_xcdrv2_representation=True)                             │ │ │
│ │ │ Deadline(deadline='infinity')                                                                                 │ │ │
│ │ │ DestinationOrder.ByReceptionTimestamp                                                                         │ │ │
│ │ │ Durability.Volatile                                                                                           │ │ │
│ │ │ History.KeepLast(depth=1)                                                                                     │ │ │
│ │ │ IgnoreLocal.Nothing                                                                                           │ │ │
│ │ │ LatencyBudget(budget='zero')                                                                                  │ │ │
│ │ │ Liveliness.Automatic(lease_duration='infinity')                                                               │ │ │
│ │ │ Ownership.Shared                                                                                              │ │ │
│ │ │ PresentationAccessScope.Instance(coherent_access=False, ordered_access=False)                                 │ │ │
│ │ │ ReaderDataLifecycle(autopurge_nowriter_samples_delay='infinity', autopurge_disposed_samples_delay='infinity') │ │ │
│ │ │ Reliability.BestEffort                                                                                        │ │ │
│ │ │ ResourceLimits(max_samples=-1, max_instances=-1, max_samples_per_instance=-1)                                 │ │ │
│ │ │ TimeBasedFilter(filter_time='zero')                                                                           │ │ │
│ │ │ TransportPriority(priority=0)                                                                                 │ │ │
│ │ │ TypeConsistency.AllowTypeCoercion(                                                                            │ │ │
│ │ │     ignore_sequence_bounds=True,                                                                              │ │ │
│ │ │     ignore_string_bounds=True,                                                                                │ │ │
│ │ │     ignore_member_names=False,                                                                                │ │ │
│ │ │     prevent_type_widening=False,                                                                              │ │ │
│ │ │     force_type_validation=False                                                                               │ │ │
│ │ │ )                                                                                                             │ │ │
│ │ ╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │ │
│ │ ┌────────────────┬───────────────────────────────────────┐                                                        │ │
│ │ │ Typename       │     unitree_go::msg::dds_::MotorCmds_ │                                                        │ │
│ │ │ XTypes Type ID │ COMPLETE 3D6FC5EAA483DD0A5B41620CCB2A │                                                        │ │
│ │ └────────────────┴───────────────────────────────────────┘                                                        │ │
│ │              Subscriptions                                                                                        │ │
│ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                                                          │ │
│ │ ┃ GUID                                 ┃                                                                          │ │
│ │ ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩                                                                          │ │
│ │ │ 0110f91d-e442-5e23-e045-6e0b00000204 │                                                                          │ │
│ │ └──────────────────────────────────────┘                                                                          │ │
│ ╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
# (3) Python publisher (PID 103474)
#   Topic: rt/motor_cmds | Publications | QoS: Reliability.Reliable, WriterDataLifecycle(autodispose=True)
╭────────────────────────────────────────────── 01108509-f0de-31a8-e4b6-9628000001c1 ──────────────────────────────────────────────────────────╮
│                                                                                                                                              │
│ ╭──────────────────────────────────────────  QoS ──────────────────────────────────────────╮                                                 │
│ │ Liveliness.Automatic(lease_duration='10 seconds')                                        │                                                 │
│ │ Property(key='__Hostname', value='unitree')                                              │                                                 │
│ │ Property(key='__NetworkAddresses', value='udp/239.255.0.1:7400@2,udp/10.0.7.70:36393@2') │                                                 │
│ │ Property(key='__Pid', value='103474')                                                    │                                                 │
│ │ Property(key='__ProcessName', value='python')                                            │                                                 │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────╯                                                 │
│                                                                                                                                              │
│ ╭───────────────────────────────────────────────────────────── rt/motor_cmds ──────────────────────────────────────────────────────────────╮ │
│ │ ╭───────────────────────────────────────────────────────────── Common QoS ─────────────────────────────────────────────────────────────╮ │ │
│ │ │ DataRepresentation(use_cdrv0_representation=True, use_xcdrv2_representation=True)                                                    │ │ │
│ │ │ Deadline(deadline='infinity')                                                                                                        │ │ │
│ │ │ DestinationOrder.ByReceptionTimestamp                                                                                                │ │ │
│ │ │ Durability.Volatile                                                                                                                  │ │ │
│ │ │ DurabilityService(cleanup_delay=0, history=History.KeepLast(depth=1), max_samples=-1, max_instances=-1, max_samples_per_instance=-1) │ │ │
│ │ │ History.KeepLast(depth=1)                                                                                                            │ │ │
│ │ │ IgnoreLocal.Nothing                                                                                                                  │ │ │
│ │ │ LatencyBudget(budget='zero')                                                                                                         │ │ │
│ │ │ Lifespan(lifespan='infinity')                                                                                                        │ │ │
│ │ │ Liveliness.Automatic(lease_duration='infinity')                                                                                      │ │ │
│ │ │ Ownership.Shared                                                                                                                     │ │ │
│ │ │ OwnershipStrength(strength=0)                                                                                                        │ │ │
│ │ │ PresentationAccessScope.Instance(coherent_access=False, ordered_access=False)                                                        │ │ │
│ │ │ Reliability.Reliable(max_blocking_time='100 milliseconds')                                                                           │ │ │
│ │ │ ResourceLimits(max_samples=-1, max_instances=-1, max_samples_per_instance=-1)                                                        │ │ │
│ │ │ TransportPriority(priority=0)                                                                                                        │ │ │
│ │ │ WriterDataLifecycle(autodispose=True)                                                                                                │ │ │
│ │ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │ │
│ │ ┌────────────────┬───────────────────────────────────────┐                                                                               │ │
│ │ │ Typename       │     unitree_go::msg::dds_::MotorCmds_ │                                                                               │ │
│ │ │ XTypes Type ID │ COMPLETE 3D6FC5EAA483DD0A5B41620CCB2A │                                                                               │ │
│ │ └────────────────┴───────────────────────────────────────┘                                                                               │ │
│ │               Publications                                                                                                               │ │
│ │ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                                                                                                 │ │
│ │ ┃ GUID                                 ┃                                                                                                 │ │
│ │ ┡━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩                                                                                                 │ │
│ │ │ 011013af-4f50-e271-6313-fde600000203 │                                                                                                 │ │
│ │ └──────────────────────────────────────┘                                                                                                 │ │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

#### 5.6.2 Summary

> **Network layer**: processes use the physical NIC at 10.0.7.70; discovery uses UDP multicast (239.255.0.1:7400).  
> **Topic layer**: common topic `rt/motor_cmds` (Unitree SDK motor control topic).  
> **Process layer**: 1 publisher (Python, PID 103474); 2 subscribers (C++ PID 102724, Python PID 102756).  
> **QoS**: publisher `Reliable` (guaranteed delivery); subscribers `BestEffort` (fast, may drop).

## 6. Unitree SDK Overview

Up to now we’ve used the **“from-scratch”** route: write IDL, generate types, create `DomainParticipant/Topic/Writer/Reader`. Great for learning and full control, but steeper learning curve.

In real projects you usually won’t re-wrap DDS types; Unitree’s **official SDK** already does that. The SDK is a higher-level API wrapping Cyclone DDS so you can drive hardware (motors, sensors, controllers) without worrying about transport details. Below: **C++** and **Python** versions.

### 6.1 C++ Version

C++ SDK: [unitree_sdk2](https://github.com/unitreerobotics/unitree_sdk2). It depends on the Cyclone DDS core and bundles required DDS types & wrappers.

Install:

```bash
cd ~
git clone https://github.com/unitreerobotics/unitree_sdk2
cd unitree_sdk2
mkdir build install
cd build
# CMAKE_INSTALL_PREFIX selects the install path
cmake .. -DCMAKE_INSTALL_PREFIX=../install
# Or system-wide:
cmake .. -DCMAKE_INSTALL_PREFIX=/usr/local
sudo make install
# You can refer to example/cmake_sample on how to import the unitree_sdk2 into your CMake project.
```

Layout:

```bash
~/unitree_sdk2$ tree -L 2
.
├── cmake
│   ├── unitree_sdk2Config.cmake.in
│   └── unitree_sdk2Targets.cmake
├── CMakeLists.txt
├── example
├── include
│   └── unitree
│       ├── common    # Infrastructure: wraps Cyclone DDS init; creates the unique DomainParticipant, sets NIC, etc.
│       ├── idl       # All robot comm IDL types (motors, dexterous hand, sensors, etc.)
│       └── robot     # High-level APIs by robot family: low-level control, high-level RPC, RC, image, etc.
├── lib
│   ├── aarch64
│   │   └── libunitree_sdk2.a
│   └── x86_64
│       └── libunitree_sdk2.a
└── thirdparty                 # Prebuilt Cyclone DDS headers and libs (see §3)
    ├── CMakeLists.txt
    ├── include
    │   ├── dds
    │   ├── ddsc
    │   └── ddscxx
    └── lib
        ├── aarch64
        └── x86_64
```

Highlights:

- **common** hides DDS init details;
- **idl** centralizes all robot comm types;
- **robot** exposes the main control APIs.

So you can just call `unitree::robot` APIs without manually handling DDS participants/topics/writers/readers.

### 6.2 Python Version

Python SDK: [unitree_sdk2_python](https://github.com/unitreerobotics/unitree_sdk2_python). It’s essentially a Python layer over the C++ SDK with similar style.

Install:

```bash
cd ~ 
git clone https://github.com/unitreerobotics/unitree_sdk2_python
cd unitree_sdk2_python
pip install -e .
```

**Error** (same as §3.3):

```bash
(base) silencht@silencht-laptop:~/unitree_sdk2_python$ pip install -e .
Obtaining file:///home/silencht/unitree_sdk2_python
  Installing build dependencies ... done
  Checking if build backend supports build_editable ... done
  Getting requirements to build editable ... done
  Preparing editable metadata (pyproject.toml) ... done
Collecting cyclonedds==0.10.2 (from unitree_sdk2py==1.0.1)
  Downloading cyclonedds-0.10.2.tar.gz (156 kB)
  Installing build dependencies ... done
  Getting requirements to build wheel ... error
  error: subprocess-exited-with-error
  
  × Getting requirements to build wheel did not run successfully.
  │ exit code: 1
  ╰─> [1 lines of output]
      Could not locate cyclonedds. Try to set CYCLONEDDS_HOME or CMAKE_PREFIX_PATH
      [end of output]
  
  note: This error originates from a subprocess, and is likely not a problem with pip.
error: subprocess-exited-with-error

× Getting requirements to build wheel did not run successfully.
│ exit code: 1
╰─> See above for output.

note: This error originates from a subprocess, and is likely not a problem with pip.
```

The Python & C++ bindings need the core C library installed; set `CYCLONEDDS_HOME` to the core’s install path before installing. See: <https://pypi.org/project/cyclonedds/#installing-with-pre-built-binaries>. For the core C install, see §3.1.

### 6.3 SDK Driver Development

*(omitted—follow SDK examples for your specific robot and features)*

### 6.4 Summary

So far we used the **“native route”**: write IDL, generate type code, create `DomainParticipant/Topic/Writer/Reader`. This is flexible and educational but steeper.

The Unitree SDK is the **“high-level API route”**: it deeply integrates DDS initialization (unique `DomainParticipant`, NIC config, resource management) and preloads all Unitree-specific IDL types & topics. You call a few high-level APIs to subscribe to state or publish commands—perfect for engineering and fast iteration.

## 7. DDS Communication Issues

### 7.1 Quick Checks

New to Cyclone DDS / Unitree SDK? Wondering whether your PC and the robot can discover each other and communicate? Try:

1. **Physical link**

   Check NIC/cable LEDs; on Wi-Fi, confirm the same AP/VLAN as the robot. With multiple NICs, decide which one will carry DDS.

   If in doubt, swap cables/ports and ensure you’re connected to the robot’s switch or a directly connected router/switch port.

2. **Same IP subnet**

   On your PC:

   ```bash
   ip addr  # or ifconfig
   ```

   The NIC used for DDS should be in `192.168.123.x/24` (matching PC1/PC2).

   If not, move it to `192.168.123.x/24`, or change your router’s LAN accordingly.

3. **Ping test**

   From your PC, ping robot IPs:

   ```bash
   ping 192.168.123.161  # PC1
   ping 192.168.123.164  # PC2
   ```

   If you get `64 bytes from ...`, the network is up.

   If not: likely wrong IP/subnet mask, disabled interface, or not actually on the same LAN. Fix that first.

4. **DDS discovery**

   Use the tools from §3.4 / §5.6:

   ```bash
   cyclonedds ps 
   # If you see topics like rt/lowstate / rt/lowcmd, discovery works.
   # If you see zero entities, discovery failed:
   0:00:01 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Entities discovered: 0
   ┏━━━━━━┳━━━━━━━━━━━━━┳━━━━━┳━━━━━━━━━━━━━━┳━━━━━━━━┓
   ┃ Host ┃ Application ┃ Pid ┃ Participants ┃ Topics ┃
   ┡━━━━━━╇━━━━━━━━━━━━━╇━━━━━╇━━━━━━━━━━━━━━╇━━━━━━━━┩
   └──────┴─────────────┴─────┴──────────────┴────────┘
   # Common causes & fixes:
   #   Not in same L2/VLAN: connect to robot’s switch or same VLAN/AP.
   #   Domain ID mismatch: set both sides to the same Domain (Unitree often uses 0).
   #   Wrong NIC/subnet: select the correct NIC during channel init,
   #   or pin the interface via env var:
   export CYCLONEDDS_URI='<CycloneDDS><Domain><General><Interfaces><NetworkInterface name="eth0"/></Interfaces></General></Domain></CycloneDDS>'
   ```

### 7.2 Development-time Checks

Once basic network and discovery are good, these tips help debug DDS data flow:

- Conditions for a subscriber to receive data:

  1. **Same Domain ID**.
  2. **Same Topic name**.
  3. **Matching IDL type**: both Typename and Type ID must match (exact fields).
  4. **QoS compatibility**: request–offer model; the subscriber’s requested QoS must be satisfiable by the publisher. Defaults usually work.

- Debugging tips:

  1. **Participants & topics present?**  
     Use `cyclonedds ps` / `cyclonedds ls` to confirm your participants and topics exist.
  2. **Check Domain & Topic**  
     Ensure Domain ID & Topic name match.
  3. **Compare Typename & Type ID**  
     If Topic matches but Type ID differs, your IDL differs—unify `.idl` and regenerate.
  4. **QoS sanity**  
     Confirm compatible QoS (especially reliability & durability). Defaults are usually fine.

In short, `cyclonedds ls` is a **DDS magnifying glass**: check participant presence → topic alignment → type/QoS compatibility to quickly isolate issues.

------

> This tutorial was written by Unitree’s [Silencht](https://github.com/silencht), based on personal practice and understanding. Mistakes may exist—critiques and discussion are welcome. 
>
> 📧 silencht@qq.com
