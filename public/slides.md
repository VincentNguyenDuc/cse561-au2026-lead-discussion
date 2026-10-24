<!-- .slide: class="title" -->

# Evolve or Die

High-Availability Design Principles Drawn from Google's Network Infrastructure

Govindan et al. · SIGCOMM 2016

Lead discussion: Vincent Nguyen, Cheng Peng

---

## Outline

1. Google's network architecture
2. Failure study: what breaks and why
3. Design principles for high availability
4. Discussion

---

<!-- .slide: class="section" -->

## Google's network architecture

---

## Network architecture

- Clusters: multi-stage Clos fabrics
- CARs connect clusters to two WANs
- **B4**: internal, SDN-based, cluster-to-cluster
- **B2**: user-facing, ISP-style, peers with the Internet

Note:
Speaker notes go here. Press S to open the speaker view.

---

## B4 vs B2

| | B4 | B2 |
|---|---|---|
| Traffic | Internal, cluster-to-cluster | User-facing, Internet peering |
| Hardware | Merchant silicon | Vendor routers |
| Control | Centralized SDN + TE | IS-IS, BGP, MPLS/RSVP |

> When B4 fails, CARs fall back to B2, and vice versa.

---

## Discussion

- Question 1
- Question 2
