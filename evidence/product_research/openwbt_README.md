<div align="center">
  <h1 align="center"> OpenWBT </h1>
  <h3 align="center"> GALBOT · Tsinghua </h3>
<!--   <p align="center">
    <a href="README.md"> English </a> | <a href="README_zh.md">中文</a>
  </p>     -->

[中文](README_zh.md) | [English](README.md)

:page_with_curl:[Paper](https://www.arxiv.org/pdf/2505.10918) | :house:[Website](https://zzk273.github.io/R2S2/) | :film_projector:[Video](https://www.youtube.com/watch?v=EmWLJROMeB0)

</div>
> 🔄 This project now supports teleoperation simulation in Isaac Sim and is under active maintenance.
🚧 Note that official Isaac Sim is still under active development, so interfaces and features may change frequently.

# Introduction
The technical implementation of this project is mainly supported by [R2S2](https://zzk273.github.io/R2S2/). This repository implements **whole body teleoperation** of the Unitree G1 and H1 humanoid robot using Apple Vision Pro. The system supports **both real robots and simulation environments**. **Only one tele-operator** is needed to control the robot to perform movements such as walking, squatting, bending, grasping, and lifting, thereby significantly expanding the robot's operational capabilities and enabling it to accomplish a wider range of tasks.

In this project, the tele-operation can be split into lower-body control and upper-body control. For lower-body control, our method allows you to control the humanoid to walk or change body pose with a pair of joystick controllers. For upper-body control, the robot hand motion is derived from the human hand poses measured in VR using inverse kinematics.

## Demonstration:
<p align="center">
<img src="./img/0611_demo.webp" width="80%"/>
</p>

<p align="center">
<img src="./img/demo.webp" width="80%"/>
</p>

<!-- <p align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <a href="https://www.bilibili.com/video/x" target="_blank">
          <img src="./img/x.jpg" alt="real.gif" width="75%">
        </a>
        <p><b> real demonstration</b></p>
      </td>
      <td align="center" width="50%">
        <a href="https://www.bilibili.com/video/x" target="_blank">
          <img src="./img/x.jpg" alt="sim.gif" width="75%">
        </a>
        <p><b> sim demonstration </b></p>
      </td>
    </tr>
  </table>
</p> -->

# Hardware and Environment Configuration
See [Installation.md](installation.md) for 1) our hardware list including the joystick and their acquisition and composition, 2) the environment configuration.

# Usage
## Starting the Robot

First turn on the robot:
- Press and hold the power button briefly, then hold it again until the blue light on the head turns on and stops blinking.

Then use the unitree remote controller to enter the damping mode (you can also refer to [Unitree official document](https://support.unitree.com/home/zh/G1_developer/remote_control)):
- Press and hold the power button briefly, then hold it again.
- Press L2+R2 to enter deployable mode.
- Press L2+A, the robot will show a ready pose.
- Press L2+B to enter damping mode.

## Connecting to the Robot via Ethernet and Starting the Image Service

For the first time you connect to the robot, you need to configure the `wifi` to install some dependencies. You can refer to [FAQ from unitree](https://support.unitree.com/home/zh/G1_developer/FAQ) for wifi configuration. We provide an example approach:

Modify the `wifi` name and corresponding password in the `01-netcfg.yaml` file, and place the `01-netcfg.yaml` file in `/etc/netplan/` on the robot:

```bash
scp ./01-netcfg.yaml unitree@192.168.123.164:~/ # Transfer to the robot's root directory

# Access the remote desktop
ssh unitree@192.168.123.164
123 # password
1 # choose ros2 foxy(1)
sudo cp 01-netcfg.yaml /etc/netplan/
netplan apply # *You may be prompted to restart the network service during this process. Try a few more times if necessary.*

# Install dependencies
pip install pyzmq
pip install pyrealsense2
```

Transfer the Python file for starting the image service to the robot and run it

```bash
scp ./deploy/teleop/image_server/image_server.py unitree@192.168.123.164:~/image_server/
scp unitree@192.168.123.164:~/image_server/image_server.py  ./deploy/teleop/

ssh unitree@192.168.123.164
123 # password
1 # choose ros2 foxy(1)
cd image_server
python image_server.py
```
## Executing the Teleoperation Program
Connect the computer to the joysticks and grant access permissions to both hands. By default, the left and right joysticks are located at /dev/ttyACM0 and /dev/ttyACM1, respectively.

```bash
sudo chmod -R 777 /dev/ttyACM0; sudo chmod -R 777 /dev/ttyACM1
```

Running in the Real:
``` bash
source /opt/ros/foxy/setup.sh; source ~/unitree_ros2/setup.sh
python -m deploy.run_teleoperation_real --config run_teleoperation.yaml --net eno1
```
Running in the mujoco Simulator:
```bash
source /opt/ros/foxy/setup.sh; source ~/unitree_ros2/setup.sh
python -m deploy.run_teleoperation_mujoco --config run_teleoperation.yaml
```

**Run in Isaac Sim (V4.5.0):**

- Ensure Isaac Sim V4.5.0 is installed. Refer to the [official documentation](https://docs.isaacsim.omniverse.nvidia.com/4.5.0/index.html)for installation instructions.

If using VR devices such as Vision Pro, run the following two commands in separate terminals to start simulation:
```bash
bash start_ik_server.sh       # Terminal 1
bash start_isaacsim_vision.sh # Terminal 2
```

For non-VR devices, run:
```bash
bash start_isaacsim.sh
```

*Note:*

- Replace eno1 with the correct network interface name.
- To enter debug mode (action from policy will not be executed) for real robot teleoperation, run:
```bash
source /opt/ros/foxy/setup.sh; source ~/unitree_ros2/setup.sh
python -m deploy.run_teleoperation_real --config run_teleoperation.yaml --net eno1 --debug
```

## Entering VR

*Prerequisites: The teleoperation program has been executed on the user's computer, and the robot's image service has been enabled.​*

**For the first-time connection and use in this project, please refer to the corresponding section in `installation.md`.​**

Open the browser on Apple Vision Pro and enter `https://192.168.123.2:8012?ws=wss://192.168.123.2:8012`.
Click "Enter VR" and allow tracking to view the first-person perspective. At this point, you can use the Vision Pro and joystick to control the actual robot.​

Note: 
- Replace the 192.168.123.2 with your own wifi IP address.

If images fail to display in VR, please double-check the following:
- You have followed the steps in installation.md, including sending, installing, and trusting the certificate
- The URL is entered exactly, with no typos or missing characters

## Control Robot Using Joystick


1. Press the `power` button on the right joystick briefly to make the robot enter the ready position.
2. Press and hold the `power` button on the right joystick for 1 seconds to make the robot enter startup mode.
3. Press the `A` button on the left joystick to make the robot enter locomotion mode - use the joysticks on both the left and right joysticks to control movement and turning.
4. In locomotion mode, press the `D` key on the left joystick to stop the robot from walking.
5. Press the `A` button on the right joystick to make the robot enter body-pose-adjustment mode - use the joysticks on both the left and right joysticks to control squatting, standing, and upper body pitch angles.
- *Press the `D` button on the right joystick to make the robot enter safe damping mode.*


# TODO List

- \[x\] Release the R2S2 paper with demos.
- \[x\] Release Unitree G1 whole body teleoperation in real world.
- \[x\] Release Unitree G1 whole body teleoperation in mujoco.
- \[x\] Release Unitree G1 whole body teleoperation in Isaac Sim.
- \[ \] Release Unitree H1 whole body teleoperation.
- \[ \] Release Latent Skill Space.

# Citation

If you find our work helpful, please cite:

```bibtex
@article{zhang2025unleashing,
  title={Unleashing Humanoid Reaching Potential via Real-world-Ready Skill Space},
  author={Zhang, Zhikai and Chen, Chao and Xue, Han and Wang, Jilong and Liang, Sikai and Liu, Yun and Zhang, Zongzhang and Wang, He and Yi, Li},
  journal={arXiv preprint arXiv:2505.10918},
  year={2025}
}
```

# License

All code of OpenWBT is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Acknowledgments
This code is built upon the following open-source repositories. Please visit the respective links to view their licenses:

1. https://github.com/OpenTeleVision/TeleVision
2. https://github.com/unitreerobotics/avp_teleoperate

# More to Say
We evaluate our model on over 5 different Unitree G1 and at over 5 different locations. The performance is very robust. If you strictly follow our sim2real deployment code, there shouldn't be any problem. However, we still suggest adopting a conservative strategy for the first-time deployment (keep a safe distance from the robot, get 
ready to kill the policy at any time). If you meet any unusual robot behavior, you can directly contact us.

# Clarification
Though the technology behind OpenWBT is mainly supported by our recent paper [R2S2](https://zzk273.github.io/R2S2/), this open source project is not a strict reproduction of this paper. We add a lot of engineering tricks to make sure the policy can be deployed as robust as possible for the community and best suited for tele-operation.

# Contact Us 

If you'd like to discuss anything, feel free to send an email to zhikaizhang273@gmail.com or add WeChat: zzk273939.

