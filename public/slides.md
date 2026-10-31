<!-- .slide: class="title" -->

# Evolve or Die

High-Availability Design Principles Drawn from Google's Network Infrastructure

Govindan et al. · SIGCOMM 2016

Lead discussion: Vincent Nguyen, Cheng Peng

---

## TL;DR

- **Data:** 103 post-mortems of Google network failures over two years
- **Finding:** failures hit every network and every plane, with no dominant root cause
- **Cause:** ~70 happened **while the network was being changed** (a management operation)
- **Lesson:** no silver bullet
- **Conclusion:** don't slow down. Upgrade *continuously*, and make change safe

> Touching the network breaks it. So touch it often, and make touching it safe.

Note:
The rest of the talk is the evidence for these lines.
MOp = management operation: upgrades, config changes, drains, replacing hardware. Google schedules ~585 a week.
The conclusion is counter-intuitive: the data says change causes failures, yet the answer is more change, made small and automated.

---

## Outline

1. Google's network
2. Why high availability is hard
3. What breaks: 103 post-mortems
4. Case studies
5. Design principles
6. Discussion

---

<!-- .slide: class="section" -->

## Google's network

---

## Three networks

<div class="net-slot" data-net="topology" data-scale="0.68"></div>

Note:
Clusters are multi-stage Clos fabrics of merchant-silicon switches (ToR, superblocks, spine).
Each cluster's CAR (cluster aggregation router) connects to one B4BR and two B2BRs.
B4 carries cluster-to-cluster traffic; B2 carries user traffic and peers with the Internet.
WAN links are bundles: many physical links aggregated between two routers.

---

## B4 vs B2

| | B4 | B2 |
|---|---|---|
| Traffic | Internal, cluster-to-cluster | User-facing, Internet peering |
| Hardware | Merchant silicon | Vendor routers |
| Control | Centralized SDN + TE | IS-IS, BGP, MPLS/RSVP |

> When B4 fails, CARs fall back to B2, and vice versa.

---

## Control plane: fabrics and B4BRs

<div class="net-slot" data-net="fabric-cp" data-scale="0.76"></div>

<p class="caption">FC and RA compute paths and routes, and the OFC programs them into switches through OFAs. Everything talks over the out-of-band CPN.</p>

Note:
Same three components in cluster fabrics and inside each B4BR.
FC: paths within the fabric. RA: speaks BGP and IS-IS with neighboring border routers and computes IP routes. OFC: programs switches via OpenFlow Agents, using what FC and RA computed.
Every component is replicated with master/standby failover (a B4BR runs three copies).
The CPN is designed to tolerate a single CPN router failure; the two routers run VRRP.

---

## Control plane: the B4 WAN

<div class="net-slot" data-net="b4-cp" data-scale="0.76"></div>

<p class="caption">Gateway reads B4BR state → Topology Modeler builds a model → TE Server computes paths from it and BwE's demand → Gateway programs B4BRs</p>

Note:
BwE (Bandwidth Enforcer) estimates demand for the TE Server and rate-limits applications to their approved share.
The data plane tunnels traffic along TE paths.
If B4 fails, traffic falls back to B2. That fallback appears in two of our case studies.

---

## Three planes

| Plane | What it does | Examples |
|---|---|---|
| Data | Forwards packets | Line cards, links, switch OS |
| Control | Computes and propagates forwarding state | FC/RA/OFC, TE Server, BGP |
| Management | Changes the network: MOps | Upgrades, config pushes, drains |

> Every failure in the paper is attributed to one of these planes.

Note:
Attribution is a judgement call. A link failure that triggers a control-plane bug counts as control plane, since the control plane should have tolerated it.

---

<!-- .slide: class="section" -->

## Why high availability is hard

---

## Why it's hard

- **Target:** only a few minutes of downtime per month for some traffic classes
- **Scale and heterogeneity:** two vendors on purpose, 2–3 generations of cluster design at once
- **Velocity:** some part of the network is being upgraded every day
- **Device management:** 20 Tb/s boxes, still managed device by device, often through a CLI
- **Tight targets vs. slow upgrades:** a border router upgrade can take 8+ hours, so either drain (costs capacity) or upgrade in place (fragile)

Note:
Availability is measured per minute. B4 uses its TE instrumentation; B2 and clusters use cluster-to-cluster pings, a system similar to Pingmesh.
A cluster is unavailable for a traffic class if loss from all other clusters exceeds a threshold of 0.1–2%.

---

## They were already doing it right

- Capacity planning, redundant routers, disjoint fiber and power
- Every controller replicated with failover; WAN replicas spread geographically
- Services register traffic priorities; BwE marks and rate-limits them
- Regression tests, canaries, disaster drills
- Every MOp documented with steps, duration and a risk assessment

> …and still: 103 high-impact failures in two years.

---

<!-- .slide: class="section" -->

## What breaks

---

## Dataset: 103 post-mortems

- Every network post-mortem at Google over two years
- **Blameless**, co-written by the affected teams, peer-reviewed
- Timeline, impact, root causes (often reproduced in a lab), action items
- Only **unique** failures: a recurrence teaches nothing new, so it isn't written up

Note:
Because of the last point, every "count" in the paper is a count of distinct failures, not a failure rate.
The authors avoid analyzing trends over time for this reason.

---

## No single place to fix

- Every network fails: clusters 40+, B4 25+, B2 comparable
- Every plane fails; only B4 leans toward control-plane failures
- Hot spots: B2BRs, CARs, fabrics (critical positions)
- Less obvious ones: ToRs (concurrent buggy pushes), the CPN, BwE

> No single network, plane or component to focus on.

---

## Failures are big and slow

- 30+ events **blackholed** traffic, often for entire clusters
- High packet loss is common for every traffic class
- ~80% lasted **10–100 minutes**, against a budget of a few minutes per month
- Under 10 min: cause was obvious. Over 100 min: low-priority loss, or a latent bug waiting on a fix

Note:
Duration runs from discovery to repair, not to full service recovery. Draining a cluster stops the bleeding, but service resumption can take much longer, e.g. while storage replication catches up.
B4 failures tend to last longer, since B4 carries no high-priority traffic.

---

## Evolution is in the loop

- ~70 of 103 failures had a **MOp in progress** on the failing element
- ~35 involved **software bugs**
- Upgrades, config changes and rollouts show up on every network

> This says nothing about what *fraction* of MOps fail: 585 a week, and only unique failures are counted.

---

## Root causes: 19 categories

<div class="cols3">
<div><h3>Data · 6</h3><ul><li>Device resource overruns</li><li>CPN failure</li><li>Concurrent hardware failure</li><li>Bad CoS markings</li><li>Fabric asymmetry or freeze</li><li>Link flaps or errors</li></ul></div>
<div><h3>Control · 7</h3><ul><li>Cascade of control-plane elements</li><li>Inconsistent control-plane elements</li><li>Concurrent buggy software push</li><li>Incorrect traffic engineering</li><li>Data and control plane out of sync</li><li>Control-plane failure</li><li>Convergence delays</li></ul></div>
<div><h3>Management · 6</h3><ul><li>Risk assessment failure</li><li>Bug in management automation</li><li>Routing misconfiguration</li><li>Competing drains or upgrades</li><li>Wrong or incomplete process</li><li>Process executed wrong</li></ul></div>
</div>

<p class="caption">6+ categories appear in all three networks: systemic, not one bad design.</p>

Note:
The authors deliberately avoid the coarse "hardware / software / config" split because it only yields generic advice.
Each category shows up 2–13 times.

---

<!-- .slide: class="section" -->

## Case studies

---

<!-- .slide: class="case" -->

## CPN-1: split brain in a B4BR

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">A B4BR runs replicated OFCs that reach their switches over the CPN</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-fail="cpn-r1" data-hl="cpn-r2">A CPN router is taken down for power re-cabling. VRRP should fail over to the other one transparently</li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-fail="ofc">But VRRP fails over <b>slower than the OFC liveness timeout</b>: the OFCs lose each other and both declare themselves master</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="ofc-1" data-fail="sw">A watchdog resolves it, but the new master can't rebuild port state, so it <b>pushes wrong forwarding state</b> to every switch</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4">The B4BR blackholes. Its clusters fail over to B2, which <b>overloads</b></li>
</ol>

Note:
Data-plane category: control plane network failure.
Two timers that were each reasonable on their own interacted badly. The fallback to B2 then turned one failure into a second one.
Principles: contain the failure radius; continuously check invariants like "each OFC has redundant connectivity to 2 CPN routers".

---

<!-- .slide: class="case" -->

## Casc-1: a cascade through B4's controllers

<div class="net-slot" data-net="b4-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Each B4 controller trusts what the one upstream of it says</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="b4br b4-bundle">During an upgrade, a WAN bundle moves between B4BRs, so link config and routing <b>briefly disagree</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="gw gw-topo" data-fail="topo">That triggers a Topology Modeler bug: some prefixes now appear to <b>originate in two clusters</b></li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="topo-te bwe" data-fail="bwe">BwE assumes a prefix has one origin, so it concludes <b>all of B4 has failed</b></li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4" data-fail="shift b2br">BwE moves B4 traffic for several metros onto B2, which <b>overloads</b></li>
</ol>

Note:
Control-plane category: cascade of control-plane elements.
A transient inconsistency during a routine upgrade became a WAN-wide traffic shift.
Principle: fail open. Verify large control-plane updates, e.g. cross-check the dual origin against probes or BGP feeds before acting on it.

---

<!-- .slide: class="case" -->

## Consis-1: RA and OFC disagree

<div class="net-slot" data-net="fabric-cp" data-scale="0.7"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">RA turns BGP/IS-IS into routes plus <b>nexthop groups</b> (ECMP sets); the OFC stores them and programs switches</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="ra sw-3">A nexthop group's last route is withdrawn. RA's delete on the switch fails transiently, so RA <b>keeps a cached copy</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="ra ra-ofc ofc">A full table update (e.g. a BGP reset) skips unused groups, so the OFC correctly <b>deletes it</b></li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-hl="ra" data-fail="ra-ofc ofc sw">A new route reuses the cached group. The OFC has no record of it and <b>drops the route</b>: no flow entries, blackhole</li>
<li class="fragment current-visible" data-fragment-index="3" data-n="4">ECMP and RPC retries made it look like intermittent loss. It took <b>weeks</b> to root-cause</li>
</ol>

Note:
Control-plane category: lack of consistency between control-plane elements.
A routing config change had made full table updates much more frequent, which made this rare sequence more likely.
Principle: maintain consistency. Tracking the difference in route counts between RA and OFC would have given early warning.

---

## Risk-1: the 30% that was really 50%

<p class="lead">MOp: power off 30% of a fabric's switches, restore, repeat (30+ hours)</p>

<div class="bars">
<div class="bar"><span>Estimated loss</span><i style="--v:30%"></i><b>~30%</b></div>
<div class="bar bad fragment"><span>Actual loss</span><i style="--v:55%"></i><b>&gt;50%</b></div>
</div>

- Estimated as safe, so services were **not drained**
- Capacity in a multistage fabric depends on its topology and power design, not just on what fraction of hardware is off
- **Risk-2:** splitting a B4BR, the estimate was off by 2×, *and* failures elsewhere sent more traffic through it

Note:
Management-plane category: risk assessment failure.
Early rule of thumb: losing more than 50% of capacity is risky, because the network is provisioned for a single failure.
Coarse estimates like this were later replaced by an automated tool.
Principle: assess risk continuously, at every step of the MOp.

---

<!-- .slide: class="case" -->

## BugAuto-1: automation vs. a new abstraction

<div class="net-slot" data-net="topology" data-scale="0.62"></div>

<ol class="steps">
<li class="fragment fade-out" data-fragment-index="0">Each cluster reaches both WANs through its CAR</li>
<li class="fragment current-visible" data-fragment-index="0" data-n="1" data-hl="car-1">A script upgrades control-plane software across the CAR's 4 blocks, <b>draining and undraining links in order</b></li>
<li class="fragment current-visible" data-fragment-index="1" data-n="2" data-hl="car-1 up-1">But <b>supertrunking</b> (one logical link across several switches) was recently enabled here, and it needs a different order</li>
<li class="fragment current-visible" data-fragment-index="2" data-n="3" data-fail="car-1 up-1 cluster-1">BGP adjacencies never came back: the cluster was <b>cut off from both WANs</b></li>
</ol>

Note:
Management-plane category: bug in management-plane automation.
The control plane evolved (supertrunking) but the management plane's scripts didn't.
Automation raised the level of abstraction and improved availability overall, but it also adds a layer that can fail at scale.
Principle: big red buttons. Keep the old trunk abstraction around and be able to fall back to it.

---

<!-- .slide: class="section" -->

## Design principles

---

## From failures to principles

| Principle | Mechanism | Case |
|---|---|---|
| Defense in depth | Contain blast radius, fallbacks | CPN-1, Casc-1 |
| Consistency | Consistent updates, invariants | Consis-1 |
| Fail open | Keep the data plane, verify big updates | Casc-1 |
| Prevention | Continuous risk assessment, canaries | Risk-1, Risk-2 |
| Recover fast | Monitoring coverage | Over-1 |
| Keep upgrading | Small, frequent changes | all of them |

---

## Defense in depth

- **Contain the failure radius:** split a B4BR or CAR into *k* virtual routers, each with its own control plane
  - One failure costs 1/*k* of capacity, and a virtual router is the unit for MOps
- **Fallbacks:** B4 → B2 and back; TE → plain IP routing
- **Big red buttons:** every new feature keeps the old one alive, plus a switch to go back

Note:
Concurrent failure of *all* replicas of a controller is not uncommon (BugAuto-1), so replication alone isn't enough.
Partitioning alternative: "color" links and switches and give each color its own control plane.

---

## Maintain consistency

- **Within the control plane:** track equivalence; RA vs. OFC route counts would have flagged Consis-1
- **Data vs. control:** don't advertise routes before they're installed
- **Management:** check fabric state after every MOp step; all-or-nothing config changes
- **Invariants:** an unwritten rule (anycast prefixes need path length 3) was broken, and internal DNS went down
- **Positive *and* negative:** a wildcard drained hundreds of devices instead of two, so now large MOps need both a "drain these" list and a "keep these" list

Note:
Many invariants are implicit: CARs connect to 2 B2BRs, OFCs connect to 2 CPN routers, at least one OFC must be running.
Monitoring should rank invariant violations by risk instead of flooding operators with alarms.

---

## Fail open

- When a control plane dies, **keep the last good forwarding state**
- Works if fixing the control plane is faster than the next hardware failure
- Don't trust surprising updates: Casc-1's dual origin could have been checked against probes or BGP feeds
- Another time, the TE Server **invalidated all of B4** over one stale prefix

Note:
This is in tension with being conservative. In both examples the controller's "safe" reaction caused the outage.
Open problems: detecting that a switch has failed open, and having healthy peers keep using it.

---

## Prevent, and recover fast

- Assess risk **continuously**, at every MOp step, for drains *and* undrains
- Easier on in-house B4 and clusters than on vendor B2, which is a black box
- Canaries: 0.1% of ToRs in a small cluster, then more, then a bigger cluster, monitoring for days at each stage
- Recovery is slow when operators **chase the wrong anomaly** or monitoring has gaps
- Over-1: both monitoring collectors were inside the cluster that failed

Note:
Operators root-cause failures using an active path-probing system (similar to Pingmesh, our other paper) and passive per-device counters.
Over-1: a drained link under bit-error testing still carried traffic. OFAs lost their OFC, the failover's reverse DNS lookups blocked, and the OS thread limit took down the whole control plane.

---

## Continuously upgrade the network!

- Slowing down means overbuilt capacity, missing features, and change running through rarely-exercised code
- Instead: push features weekly, be able to upgrade daily
- Many small changes are safer and easier to verify than one "big bang"
- Frequent change forces automation, and stops assumptions like "every component runs the same version"

> Touching the network breaks it. So touch it often, and make touching it safe.

---

<!-- .slide: class="section" -->

## Discussion

---

## Discussion

- B4's failures are mostly control-plane. Does centralized SDN trade one kind of failure for another?
- In Casc-1, the "conservative" reaction caused the outage. When should a controller fail open, and when fail safe?
- Only unique failures, in the authors' own categories: what can we conclude about frequency?
- Is "upgrade continuously" a lesson for everyone, or only with Google-scale automation?
- Two vendors on purpose: does heterogeneity buy more availability than its complexity costs?
