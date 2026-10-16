# Assignment 03 - DevOps Track

## Written Answers

**1. What does chmod 640 mean? Why is the env file 600?**
640 means the owner can read and write, the group can only read, and everyone else has no access. The env file is 600 because it holds secrets like JWT_SECRET and the database password, so only the owner (deploy) can be able to read it. Nobody else, not even the group can read it.

**2. Why allow SSH in ufw before enabling it? What does default-deny incoming mean?**
Once ufw is enabled it blocks everything that isn't explicitly allowed, including the SSH connection being used. If SSH isn't allowed first,  it locks the user out of the server. Default-deny incoming means every incoming connection is blocked unless a rule allows it, so only ports 22 and 3001 are reachable and Postgres and Redis stay closed to the outside.

**3. Which key goes on the server and which never leaves my laptop? Why is it safe to give the instructor my public key?**
The public key goes on the server, in ~/.ssh/authorized_keys. The private key never leaves my laptop. The public key can only verify a login, not create one, so having it doesn't let anyone log in as me. Only the holder of the private key can prove they match it.

**4. Why does the API run as deploy and not root? What does Restart=on-failure do, and does systemctl stop trigger it?**
It runs as deploy because of least privilege. If the API is compromised, the attacker only gets deploy's access instead of full control of the machine. Restart=on-failure makes systemd restart the service after it crashes or is killed, such as with kill -9. systemctl stop does not trigger it, because a deliberate stop is not a failure.

**5. Why run sshd -t and keep a second session open before restarting SSH?**
sshd -t checks the config for mistakes. If the config has a typo and SSH restarts anyway, the SSH service may not come back and I lose remote access. The second session stays logged in even if the restart goes wrong, so I can fix the problem, and I can test the new settings from another terminal before closing the first.
]633;E;echo;5caa10a0-d8d2-45ee-9b5c-a7c4883b9960]633;C
## Evidence

### hostnamectl
 Static hostname: bucc
       Icon name: computer-vm
         Chassis: vm 🖴
      Machine ID: 5f1a3b07b99d4db9b3b674c926eb6f66
         Boot ID: a8f8e3d75e304a08b9d64be33ff53474
  Virtualization: microsoft
Operating System: Ubuntu 24.04.5 LTS
          Kernel: Linux 6.8.0-147-generic
    Architecture: x86-64
 Hardware Vendor: Microsoft Corporation
  Hardware Model: Virtual Machine
Firmware Version: Hyper-V UEFI Release v4.1
   Firmware Date: Thu 2025-09-25
    Firmware Age: 1y 3w

### ls -l notes.txt and env file
-rw------- 1 deploy deploy 329 Oct 15 10:07 /etc/online-store/online-store.env
-rw-r----- 1 deploy deploy  11 Oct 13 20:02 /opt/online-store/notes.txt

### sshd -T excerpts
permitrootlogin no
passwordauthentication no

### ufw status verbose
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), deny (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp (OpenSSH)           ALLOW IN    Anywhere                  
22/tcp (OpenSSH (v6))      ALLOW IN    Anywhere (v6)             

